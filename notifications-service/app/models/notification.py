"""
Notification model — the core entity for the Notifications Service.

Each notification request creates a Notification record with its
status tracked through the lifecycle: queued → sending → sent/failed.
"""

import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Enum, Boolean, DateTime, Integer, JSON, ForeignKey
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class NotificationChannel(str, enum.Enum):
    """Supported notification delivery channels."""
    SMS = "sms"
    EMAIL = "email"
    IN_APP = "in_app"
    PUSH = "push"


class NotificationStatus(str, enum.Enum):
    """Lifecycle status of a notification."""
    PENDING = "pending"
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"


class Notification(Base):
    """A single notification request and its delivery status."""

    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── What ──────────────────────────────────────────────────────────
    channel = Column(Enum(NotificationChannel), nullable=False, index=True)
    recipient = Column(String(255), nullable=False, index=True)
    subject = Column(String(500), nullable=True)  # For email
    title = Column(String(255), nullable=True)    # For in-app / push
    body = Column(Text, nullable=False)

    # ── Template ──────────────────────────────────────────────────────
    template_name = Column(String(100), nullable=True)
    template_data = Column(JSON, nullable=True, default=dict)

    # ── Status ────────────────────────────────────────────────────────
    status = Column(
        Enum(NotificationStatus),
        default=NotificationStatus.PENDING,
        nullable=False,
        index=True,
    )
    provider = Column(String(50), nullable=True)    # twilio, termii, smtp, etc.
    provider_message_id = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)

    # ── Retry ─────────────────────────────────────────────────────────
    attempt_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)

    # ── Context ───────────────────────────────────────────────────────
    institution_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    institution_name = Column(String(255), nullable=True)
    source_service = Column(String(100), nullable=True, default="hms-backend")
    metadata_ = Column("metadata", JSON, nullable=True, default=dict)

    # ── Timestamps ────────────────────────────────────────────────────
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────
    logs = relationship("NotificationLog", back_populates="notification", cascade="all, delete-orphan")

    def __repr__(self):
        return (
            f"<Notification id={self.id} channel={self.channel} "
            f"recipient={self.recipient} status={self.status}>"
        )
