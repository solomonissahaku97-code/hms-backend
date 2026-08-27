"""
Redis Queue — lightweight async job queue for notification processing.

Uses Redis lists as a FIFO queue. Notifications are pushed to the
queue and processed by a background worker.

Queue structure:
  notifications:pending  → jobs waiting to be processed
  notifications:sent     → completed jobs (for audit)
  notifications:failed   → failed jobs (for retry)
"""

import json
import redis.asyncio as aioredis
import structlog

from app.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# Queue keys
QUEUE_PENDING = "notifications:pending"
QUEUE_SENT = "notifications:sent"
QUEUE_FAILED = "notifications:failed"


class NotificationQueue:
    """Redis-backed notification queue."""

    def __init__(self):
        self._redis: aioredis.Redis | None = None

    async def connect(self):
        """Connect to Redis."""
        self._redis = aioredis.from_url(
            settings.REDIS_URL,
            db=settings.REDIS_QUEUE_DB,
            decode_responses=True,
        )
        await self._redis.ping()
        logger.info("queue_connected", redis_url=settings.REDIS_URL)

    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()

    async def enqueue(self, notification_id: str, channel: str, recipient: str, body: str) -> bool:
        """
        Push a notification to the pending queue.

        Args:
            notification_id: UUID of the notification record
            channel: sms, email, in_app, push
            recipient: Phone number, email, or user ID
            body: Message body

        Returns:
            True if enqueued successfully
        """
        job = {
            "notification_id": notification_id,
            "channel": channel,
            "recipient": recipient,
            "body": body,
        }

        try:
            await self._redis.lpush(QUEUE_PENDING, json.dumps(job))
            logger.info("notification_queued", notification_id=notification_id, channel=channel)
            return True
        except Exception as e:
            logger.error("queue_enqueue_failed", error=str(e), notification_id=notification_id)
            return False

    async def dequeue(self) -> dict | None:
        """
        Pop the next job from the pending queue (blocking with timeout).

        Returns:
            Job dict or None if queue is empty
        """
        try:
            # BRPOP: blocking right pop (FIFO from left)
            result = await self._redis.brpop(QUEUE_PENDING, timeout=5)
            if result:
                _, job_data = result
                job = json.loads(job_data)
                logger.info("queue_consumed", notification_id=job.get("notification_id"))
                return job
            return None
        except Exception as e:
            logger.error("queue_dequeue_failed", error=str(e))
            return None

    async def mark_sent(self, notification_id: str):
        """Move a job to the sent queue."""
        try:
            await self._redis.lpush(QUEUE_SENT, notification_id)
        except Exception as e:
            logger.error("queue_mark_sent_failed", error=str(e))

    async def mark_failed(self, notification_id: str, error: str):
        """Move a job to the failed queue."""
        try:
            job = {"notification_id": notification_id, "error": error}
            await self._redis.lpush(QUEUE_FAILED, json.dumps(job))
        except Exception as e:
            logger.error("queue_mark_failed_failed", error=str(e))

    async def get_queue_lengths(self) -> dict:
        """Get the current length of each queue."""
        try:
            return {
                "pending": await self._redis.llen(QUEUE_PENDING),
                "sent": await self._redis.llen(QUEUE_SENT),
                "failed": await self._redis.llen(QUEUE_FAILED),
            }
        except Exception:
            return {"pending": -1, "sent": -1, "failed": -1}

    async def health_check(self) -> bool:
        """Check if Redis is reachable."""
        try:
            await self._redis.ping()
            return True
        except Exception:
            return False


# Singleton
notification_queue = NotificationQueue()
