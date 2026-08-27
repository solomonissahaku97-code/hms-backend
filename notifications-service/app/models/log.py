"""
Notification Log model — audit trail for every delivery attempt.

Each notification can have multiple log entries (one per retry attempt,
provider callback, status change, etc.).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, JSON, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class NotificationLog(Base):
    """
    Immutable audit log entry for a notification.

    One notification can have many log entries representing:
    - Queue ingestion
    - Provider send attempt
    - Provider response (success or failure)
    - Retry attempts
    - Status changes
    """

    __tablename__ = "notification_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Foreign Key ───────────────────────────────────────────────────
    notification_id = Column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Event ─────────────────────────────────────────────────────────
    event = Column(String(50), nullable=False, index=True)
    # e.g. "queued", "sending", "sent", "failed", "retry_scheduled", "provider_error"

    attempt_number = Column(Integer, nullable=True)

    # ── Provider Details ──────────────────────────────────────────────
    provider = Column(String(50), nullable=True)
    provider_message_id = Column(String(255), nullable=True)
    provider_response = Column(JSON, nullable=True)

    # ── Error ─────────────────────────────────────────────────────────
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)

    # ── Timestamp ─────────────────────────────────────────────────────
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ── Relationship ──────────────────────────────────────────────────
    notification = relationship("Notification", back_populates="logs")

    def __repr__(self):
        return f"<NotificationLog event={self.event} notification={self.notification_id}>"
