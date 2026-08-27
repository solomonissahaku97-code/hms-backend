"""
Notification API Routes — RESTful endpoints for the Notifications Service.

Endpoints:
  POST /api/v1/notifications/send/          → Send a notification
  POST /api/v1/notifications/send/bulk/     → Send to multiple recipients
  GET  /api/v1/notifications/               → List notifications (paginated)
  GET  /api/v1/notifications/{id}/          → Get notification detail
  GET  /api/v1/notifications/stats/         → Get delivery statistics
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import verify_request
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationRequest,
    BulkNotificationRequest,
    NotificationResponse,
    NotificationListResponse,
    BulkNotificationResponse,
)
from app.services.notification import send_notification, get_notifications
from app.logging_config import LogEvents
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


# ── Send Notification ───────────────────────────────────────────────────

@router.post("/send/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def send(
    request: NotificationRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_request),
):
    """
    Send a notification.

    The notification is persisted to the database and enqueued for
    async delivery via the appropriate provider (SMS, Email, In-App, Push).

    Example request:
        ```json
        {
            "recipient": "233XXXXXXXXX",
            "channel": "sms",
            "template": "appointment_reminder",
            "data": {
                "patient_name": "John Doe",
                "appointment_date": "2026-08-27",
                "appointment_time": "10:00"
            }
        }
        ```
    """
    try:
        notification = await send_notification(
            db=db,
            channel=request.channel,
            recipient=request.recipient,
            body=request.body,
            subject=request.subject,
            title=request.title,
            template_name=request.template,
            template_data=request.data,
            institution_id=request.institution_id,
            institution_name=request.institution_name,
            source_service="hms-backend",
            metadata=request.metadata,
        )

        return NotificationResponse(
            id=notification.id,
            channel=notification.channel.value,
            recipient=notification.recipient,
            subject=notification.subject,
            title=notification.title,
            body=notification.body,
            status=notification.status.value,
            provider=notification.provider,
            provider_message_id=notification.provider_message_id,
            error_message=notification.error_message,
            attempt_count=notification.attempt_count,
            institution_id=str(notification.institution_id) if notification.institution_id else None,
            institution_name=notification.institution_name,
            source_service=notification.source_service,
            template_name=notification.template_name,
            created_at=notification.created_at,
            sent_at=notification.sent_at,
            delivered_at=notification.delivered_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("send_notification_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send notification",
        )


# ── Bulk Send ───────────────────────────────────────────────────────────

@router.post("/send/bulk/", response_model=BulkNotificationResponse)
async def send_bulk(
    request: BulkNotificationRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_request),
):
    """
    Send the same notification to multiple recipients.

    Each recipient gets their own notification record and queue job.
    Returns counts of successfully queued and failed notifications.
    """
    queued = 0
    failed = 0
    notification_ids = []

    for recipient in request.recipients:
        try:
            notification = await send_notification(
                db=db,
                channel=request.channel,
                recipient=recipient,
                body=request.body,
                subject=request.subject,
                title=request.title,
                template_name=request.template,
                template_data=request.data,
                institution_id=request.institution_id,
                institution_name=request.institution_name,
                source_service="hms-backend",
            )
            queued += 1
            notification_ids.append(str(notification.id))
        except Exception as e:
            failed += 1
            logger.error("bulk_send_failed", recipient=recipient, error=str(e))

    return BulkNotificationResponse(
        queued=queued,
        failed=failed,
        notification_ids=notification_ids,
    )


# ── List Notifications ──────────────────────────────────────────────────

@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    channel: str = Query(None),
    status: str = Query(None),
    institution_id: str = Query(None),
    recipient: str = Query(None),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_request),
):
    """
    List notifications with optional filtering and pagination.

    Query parameters:
      - page: Page number (default: 1)
      - page_size: Items per page (default: 20, max: 100)
      - channel: Filter by channel (sms, email, in_app, push)
      - status: Filter by status (pending, queued, sent, failed, etc.)
      - institution_id: Filter by institution
      - recipient: Filter by recipient
    """
    items, total, pages = await get_notifications(
        db=db,
        page=page,
        page_size=page_size,
        channel=channel,
        status=status,
        institution_id=institution_id,
        recipient=recipient,
    )

    return NotificationListResponse(
        items=[
            NotificationResponse(
                id=n.id,
                channel=n.channel.value,
                recipient=n.recipient,
                subject=n.subject,
                title=n.title,
                body=n.body,
                status=n.status.value,
                provider=n.provider,
                provider_message_id=n.provider_message_id,
                error_message=n.error_message,
                attempt_count=n.attempt_count,
                institution_id=str(n.institution_id) if n.institution_id else None,
                institution_name=n.institution_name,
                source_service=n.source_service,
                template_name=n.template_name,
                created_at=n.created_at,
                sent_at=n.sent_at,
                delivered_at=n.delivered_at,
            )
            for n in items
        ],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ── Get Notification Detail ─────────────────────────────────────────────

@router.get("/{notification_id}/", response_model=NotificationResponse)
async def get_notification(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_request),
):
    """Get a single notification by ID."""
    try:
        uid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification ID format",
        )

    result = await db.execute(
        select(Notification).where(Notification.id == uid)
    )
    notification = result.scalar_one_or_none()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    return NotificationResponse(
        id=notification.id,
        channel=notification.channel.value,
        recipient=notification.recipient,
        subject=notification.subject,
        title=notification.title,
        body=notification.body,
        status=notification.status.value,
        provider=notification.provider,
        provider_message_id=notification.provider_message_id,
        error_message=notification.error_message,
        attempt_count=notification.attempt_count,
        institution_id=str(notification.institution_id) if notification.institution_id else None,
        institution_name=notification.institution_name,
        source_service=notification.source_service,
        template_name=notification.template_name,
        created_at=notification.created_at,
        sent_at=notification.sent_at,
        delivered_at=notification.delivered_at,
    )
