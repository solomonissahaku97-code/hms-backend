"""StockAlert model."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils.types import AlertType, Priority


class StockAlert(Base):
    __tablename__ = "stock_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(as_uuid=True), nullable=False)
    batch_id = Column(UUID(as_uuid=True), nullable=True)
    institution_id = Column(UUID(as_uuid=True), nullable=True)
    alert_type = Column(Enum(AlertType), nullable=False)
    message = Column(Text, nullable=True)
    priority = Column(Enum(Priority), nullable=False)
    current_quantity = Column(Integer, nullable=False)
    threshold_quantity = Column(Integer, nullable=False)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    resolved_date = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    notified = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
