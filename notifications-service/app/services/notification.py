"""
Core Notification Service — orchestrates the full notification lifecycle.

  Request → Validate → Create Record → Enqueue → Worker → Provider → Log
"""

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from app.models.notification import Notification, NotificationStatus, NotificationChannel
from app.models.template import NotificationTemplate
from app.models.log import NotificationLog
from app.services.queue import notification_queue
from app.services.providers import get_provider
from app.logging_config import LogEvents

logger = structlog.get_logger()


async def send_notification(
    db: AsyncSession,
    channel: str,
    recipient: str,
    body: str = None,
    subject: str = None,
    title: str = None,
    template_name: str = None,
    template_data: dict = None,
    institution_id: str = None,
    institution_name: str = None,
    source_service: str = "hms-backend",
    metadata: dict = None,
) -> Notification:
    """
    Create a notification and enqueue it for delivery.

    This is the main entry point called by the API routes.
    """
    # ── Resolve template if provided ───────────────────────────────
    if template_name:
        template = await get_template(db, template_name)
        if template:
            rendered = template.render(template_data or {})
            body = body or rendered.get("body")
            subject = subject or rendered.get("subject")
            title = title or rendered.get("title")
        else:
            logger.warning("template_not_found", template_name=template_name)

    if not body:
        raise ValueError("Notification body is required (either directly or via template)")

    # ── Create notification record ─────────────────────────────────
    notification = Notification(
        channel=NotificationChannel(channel),
        recipient=recipient,
        subject=subject,
        title=title,
        body=body,
        template_name=template_name,
        template_data=template_data or {},
        status=NotificationStatus.PENDING,
        institution_id=institution_id,
        institution_name=institution_name,
        source_service=source_service,
        metadata_=metadata or {},
    )
    db.add(notification)
    await db.flush()  # Get the UUID without committing

    # ── Create initial log entry ───────────────────────────────────
    log = NotificationLog(
        notification_id=notification.id,
        event="created",
        provider=None,
    )
    db.add(log)

    logger.info(
        LogEvents.NOTIFICATION_REQUESTED,
        notification_id=str(notification.id),
        channel=channel,
        recipient=recipient,
        source=source_service,
    )

    # ── Enqueue for async processing ───────────────────────────────
    enqueued = await notification_queue.enqueue(
        notification_id=str(notification.id),
        channel=channel,
        recipient=recipient,
        body=body,
    )

    if enqueued:
        notification.status = NotificationStatus.QUEUED
        log_queued = NotificationLog(
            notification_id=notification.id,
            event="queued",
            provider=None,
        )
        db.add(log_queued)
        logger.info(LogEvents.NOTIFICATION_QUEUED, notification_id=str(notification.id))
    else:
        notification.status = NotificationStatus.FAILED
        notification.error_message = "Failed to enqueue notification"

    return notification


async def process_notification(notification_id: str, db_session_factory):
    """
    Process a single notification — called by the worker.

    Loads the notification, resolves the provider, sends, and updates status.
    """
    async with db_session_factory() as db:
        # ── Load notification ──────────────────────────────────────
        result = await db.execute(
            select(Notification).where(Notification.id == notification_id)
        )
        notification = result.scalar_one_or_none()

        if not notification:
            logger.error("notification_not_found", notification_id=notification_id)
            return

        # ── Update status ──────────────────────────────────────────
        notification.status = NotificationStatus.SENDING
        notification.attempt_count += 1
        notification.last_attempt_at = datetime.now(timezone.utc)

        log_sending = NotificationLog(
            notification_id=notification.id,
            event="sending",
            attempt_number=notification.attempt_count,
            provider=notification.channel.value,
        )
        db.add(log_sending)

        logger.info(
            LogEvents.NOTIFICATION_PROCESSING,
            notification_id=str(notification.id),
            channel=notification.channel.value,
            attempt=notification.attempt_count,
        )

        try:
            # ── Get provider and send ──────────────────────────────
            provider = get_provider(notification.channel.value)
            result = await provider.send(
                recipient=notification.recipient,
                body=notification.body,
                subject=notification.subject,
                title=notification.title,
            )

            if result.success:
                notification.status = NotificationStatus.SENT
                notification.provider = result.provider
                notification.provider_message_id = result.provider_message_id
                notification.sent_at = datetime.now(timezone.utc)

                log_sent = NotificationLog(
                    notification_id=notification.id,
                    event="sent",
                    attempt_number=notification.attempt_count,
                    provider=result.provider,
                    provider_message_id=result.provider_message_id,
                    provider_response=result.raw_response,
                )
                db.add(log_sent)

                await notification_queue.mark_sent(str(notification.id))
                logger.info(
                    LogEvents.NOTIFICATION_SENT,
                    notification_id=str(notification.id),
                    provider=result.provider,
                )
            else:
                await handle_failure(notification, result.error_message, db)

        except Exception as e:
            await handle_failure(notification, str(e), db)

        await db.commit()


async def handle_failure(notification: Notification, error_message: str, db):
    """Handle a failed notification — retry or mark as failed."""
    notification.error_message = error_message
    notification.last_attempt_at = datetime.now(timezone.utc)

    log_error = NotificationLog(
        notification_id=notification.id,
        event="provider_error",
        attempt_number=notification.attempt_count,
        provider=notification.provider,
        error_message=error_message,
    )
    db.add(log_error)

    logger.error(
        LogEvents.NOTIFICATION_FAILED,
        notification_id=str(notification.id),
        error=error_message,
        attempt=notification.attempt_count,
    )

    if notification.attempt_count < notification.max_retries:
        # Schedule retry with exponential backoff
        from app.config import get_settings
        settings = get_settings()
        import asyncio

        backoff = settings.RETRY_BACKOFF_BASE * (2 ** (notification.attempt_count - 1))
        notification.status = NotificationStatus.RETRYING
        notification.next_retry_at = datetime.now(timezone.utc).replace(
            second=0, microsecond=0
        )

        log_retry = NotificationLog(
            notification_id=notification.id,
            event="retry_scheduled",
            attempt_number=notification.attempt_count,
        )
        db.add(log_retry)

        logger.info(
            LogEvents.RETRY_ATTEMPT,
            notification_id=str(notification.id),
            next_attempt=notification.attempt_count + 1,
            backoff_seconds=backoff,
        )
    else:
        notification.status = NotificationStatus.FAILED
        await notification_queue.mark_failed(str(notification.id), error_message)


async def get_template(db: AsyncSession, name: str) -> NotificationTemplate | None:
    """Look up a notification template by name."""
    result = await db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.name == name,
            NotificationTemplate.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def get_notifications(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    channel: str = None,
    status: str = None,
    institution_id: str = None,
    recipient: str = None,
):
    """Query notifications with filtering and pagination."""
    query = select(Notification)
    count_query = select(func.count(Notification.id))

    if channel:
        query = query.where(Notification.channel == channel)
        count_query = count_query.where(Notification.channel == channel)
    if status:
        query = query.where(Notification.status == status)
        count_query = count_query.where(Notification.status == status)
    if institution_id:
        query = query.where(Notification.institution_id == institution_id)
        count_query = count_query.where(Notification.institution_id == institution_id)
    if recipient:
        query = query.where(Notification.recipient == recipient)
        count_query = count_query.where(Notification.recipient == recipient)

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Paginated results
    offset = (page - 1) * page_size
    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    pages = (total + page_size - 1) // page_size if total else 0

    return items, total, pages
