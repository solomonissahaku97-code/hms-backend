"""IssuedItem model."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class IssuedItem(Base):
    __tablename__ = "issued_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(as_uuid=True), nullable=False)
    batch_id = Column(UUID(as_uuid=True), nullable=True)
    institution_id = Column(UUID(as_uuid=True), nullable=True)
    issue_number = Column(String(50), unique=True, nullable=False)
    quantity = Column(Integer, nullable=False)
    issued_to = Column(UUID(as_uuid=True), nullable=True)
    department_id = Column(UUID(as_uuid=True), nullable=True)
    issued_by = Column(UUID(as_uuid=True), nullable=True)
    issue_date = Column(DateTime(timezone=True), default=datetime.utcnow)
    purpose = Column(Text, nullable=True)
    status = Column(Enum("issued", "returned", "partially_returned", name="issue_status_enum"), default="issued")
    return_date = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column("createdAt", DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
