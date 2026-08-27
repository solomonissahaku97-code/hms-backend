"""
Pydantic schemas for notification API request/response validation.
"""

from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


# ── Request Schemas ────────────────────────────────────────────────────

class NotificationRequest(BaseModel):
    """
    Request to send a notification.

    Example:
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
    """
    recipient: str = Field(..., min_length=1, max_length=255, description="Recipient phone, email, or user ID")
    channel: str = Field(..., description="Notification channel: sms, email, in_app, push")
    template: Optional[str] = Field(None, description="Template name (if using a template)")
    subject: Optional[str] = Field(None, max_length=500, description="Subject line (for email)")
    title: Optional[str] = Field(None, max_length=255, description="Title (for in-app / push)")
    body: Optional[str] = Field(None, description="Message body (required if no template)")
    data: dict = Field(default_factory=dict, description="Template variable data")
    institution_id: Optional[str] = Field(None, description="Institution UUID")
    institution_name: Optional[str] = Field(None, description="Institution name")
    metadata: dict = Field(default_factory=dict, description="Additional metadata")

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v):
        allowed = {"sms", "email", "in_app", "push"}
        if v not in allowed:
            raise ValueError(f"channel must be one of: {', '.join(sorted(allowed))}")
        return v


class BulkNotificationRequest(BaseModel):
    """Send the same notification to multiple recipients."""
    recipients: list[str] = Field(..., min_length=1, max_length=100)
    channel: str
    template: Optional[str] = None
    subject: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    data: dict = Field(default_factory=dict)
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None


# ── Response Schemas ───────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    """Notification detail response."""
    id: UUID
    channel: str
    recipient: str
    subject: Optional[str] = None
    title: Optional[str] = None
    body: str
    status: str
    provider: Optional[str] = None
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None
    attempt_count: int = 0
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None
    source_service: Optional[str] = None
    template_name: Optional[str] = None
    created_at: datetime
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Paginated list of notifications."""
    items: list[NotificationResponse]
    total: int
    page: int
    page_size: int
    pages: int


class BulkNotificationResponse(BaseModel):
    """Response after submitting a bulk notification request."""
    queued: int
    failed: int
    notification_ids: list[str]


# ── Health ─────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """Service health check response."""
    status: str
    service: str
    version: str
    database: str
    redis: str
    timestamp: datetime
