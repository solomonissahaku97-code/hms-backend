"""
In-App Notification Provider.

In-app notifications are stored in the database and delivered via
WebSocket (handled by the HMS backend or a separate WebSocket service).

This provider simply persists the notification — the delivery layer
is handled elsewhere.
"""

from typing import Optional
import structlog

from app.services.providers.base import BaseProvider, ProviderResult

logger = structlog.get_logger()


class InAppProvider(BaseProvider):
    """In-app notification provider — persists to database."""

    name = "in_app"

    async def send(
        self,
        recipient: str,
        body: str,
        subject: Optional[str] = None,
        title: Optional[str] = None,
        **kwargs,
    ) -> ProviderResult:
        """
        Store an in-app notification.

        The notification is already persisted by the notification service.
        This provider handles any additional logic (e.g. WebSocket push,
        badge count update).
        """
        logger.info(
            "in_app_notification_created",
            recipient=recipient,
            title=title,
        )

        # TODO: Emit WebSocket event to connected clients
        # This would integrate with the HMS backend's Socket.IO
        # or a dedicated WebSocket service.

        return ProviderResult(
            success=True,
            provider="in_app",
            raw_response={"delivery_method": "websocket"},
        )
