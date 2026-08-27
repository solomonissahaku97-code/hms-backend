"""
Notification Template model — stores reusable message templates
with variable placeholders.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, JSON, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class NotificationTemplate(Base):
    """
    A reusable notification template.

    Templates support variable interpolation using {variable_name} syntax.
    For example:

        title: "Appointment Reminder"
        body: "Dear {patient_name}, your appointment is on {appointment_date} at {appointment_time}."
    """

    __tablename__ = "notification_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Identity ──────────────────────────────────────────────────────
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(500), nullable=True)

    # ── Channel ───────────────────────────────────────────────────────
    channel = Column(String(50), nullable=False)  # sms, email, in_app, push

    # ── Content ───────────────────────────────────────────────────────
    subject = Column(String(500), nullable=True)  # For email
    title = Column(String(255), nullable=True)    # For in-app / push
    body = Column(Text, nullable=False)

    # ── Variables ─────────────────────────────────────────────────────
    # JSON array of expected variable names, e.g. ["patient_name", "appointment_date"]
    variables = Column(JSON, nullable=True, default=list)

    # ── Metadata ──────────────────────────────────────────────────────
    is_active = Column(Boolean, default=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def render(self, data: dict) -> dict:
        """
        Render the template with the provided data.
        Returns a dict with rendered subject, title, and body.
        """
        rendered = {
            "subject": self._interpolate(self.subject, data) if self.subject else None,
            "title": self._interpolate(self.title, data) if self.title else None,
            "body": self._interpolate(self.body, data),
        }
        return rendered

    def _interpolate(self, text: str, data: dict) -> str:
        """Replace {variable} placeholders with actual values."""
        try:
            return text.format(**data)
        except KeyError as e:
            # Return the original text if a variable is missing
            return text

    def __repr__(self):
        return f"<NotificationTemplate name={self.name} channel={self.channel}>"
