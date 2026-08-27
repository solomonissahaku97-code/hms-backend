"""InventoryRecord model - movement audit trail."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils.types import MovementType


class InventoryRecord(Base):
    __tablename__ = "inventory_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(as_uuid=True), nullable=False)
    batch_id = Column(UUID(as_uuid=True), nullable=True)
    department_id = Column(UUID(as_uuid=True), nullable=True)
    institution_id = Column(UUID(as_uuid=True), nullable=True)
    quantity = Column(Integer, nullable=False)
    movement_type = Column(Enum(MovementType), nullable=False)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    issued_by = Column(UUID(as_uuid=True), nullable=True)
    notes = Column(Text, nullable=True)
    date = Column(DateTime(timezone=True), default=datetime.utcnow)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
