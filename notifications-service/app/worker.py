"""
Notification Worker — background process that consumes the Redis queue
and delivers notifications via the appropriate provider.

Run as a separate process:
  python -m app.worker

Or as a thread within the main app (for development).
"""

import asyncio
import signal
import sys
import structlog

from app.config import get_settings
from app.database import async_session_factory
from app.services.queue import notification_queue
from app.services.notification import process_notification
from app.logging_config import LogEvents, configure_logging

logger = structlog.get_logger()
settings = get_settings()

# Graceful shutdown flag
_running = True


def handle_signal(signum, frame):
    global _running
    logger.info("worker_shutdown_signal", signal=signum)
    _running = False


async def worker_loop():
    """
    Main worker loop — dequeues notifications and processes them.

    Uses BRPOP (blocking right pop) for efficient queue consumption.
    The 5-second timeout allows the worker to check the shutdown flag.
    """
    logger.info(LogEvents.STARTUP, component="worker", redis_url=settings.REDIS_URL)

    await notification_queue.connect()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    while _running:
        try:
            job = await notification_queue.dequeue()

            if job is None:
                # Timeout — no job available, loop again
                continue

            notification_id = job.get("notification_id")
            if not notification_id:
                logger.error("worker_invalid_job", job=job)
                continue

            logger.info(
                LogEvents.QUEUE_CONSUMED,
                notification_id=notification_id,
                channel=job.get("channel"),
            )

            await process_notification(notification_id, async_session_factory)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("worker_loop_error", error=str(e))
            await asyncio.sleep(1)  # Brief pause before retrying

    await notification_queue.close()
    logger.info(LogEvents.SHUTDOWN, component="worker")


def main():
    """Entry point for the worker process."""
    configure_logging(debug=settings.DEBUG)
    asyncio.run(worker_loop())


if __name__ == "__main__":
    main()
