"""StockAdjustment model."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(as_uuid=True), nullable=True)
    batch_id = Column(UUID(as_uuid=True), nullable=True)
    institution_id = Column(UUID(as_uuid=True), nullable=True)
    adjustment_number = Column(String(50), unique=True, nullable=False)
    adjustment_type = Column(Enum("increase", "decrease", name="adjustment_type_enum"), nullable=False)
    quantity = Column(Integer, nullable=True)
    reason = Column(Text, nullable=True)
    adjusted_by = Column(UUID(as_uuid=True), nullable=True)
    adjusted_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column("createdAt", DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
