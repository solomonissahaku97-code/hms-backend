"""ItemBatch model - batch tracking with expiry."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils.types import BatchStatus


class ItemBatch(Base):
    __tablename__ = "item_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    institution_id = Column(UUID(as_uuid=True), nullable=True)
    batch_number = Column(String(100), nullable=False, unique=True)
    quantity = Column(Integer, nullable=False)
    current_quantity = Column(Integer, nullable=False)
    unit_cost = Column(Float, nullable=False)
    selling_price = Column(Float, nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    manufacture_date = Column(DateTime(timezone=True), nullable=True)
    supplier_id = Column(UUID(as_uuid=True), nullable=False)
    received_date = Column(DateTime(timezone=True), default=datetime.utcnow)
    status = Column(Enum(BatchStatus), default=BatchStatus.ACTIVE)
    location = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column("createdAt", DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
