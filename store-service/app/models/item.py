"""Item model - stock items catalog."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils.types import ItemCategory


class Item(Base):
    __tablename__ = "items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(UUID(as_uuid=True), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(Enum(ItemCategory), nullable=False)
    unit_of_measure = Column(String(50), nullable=False, default="pieces")
    reorder_level = Column(Integer, nullable=False, default=10)
    critical_level = Column(Integer, nullable=False, default=5)
    supplier_id = Column(UUID(as_uuid=True), nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
