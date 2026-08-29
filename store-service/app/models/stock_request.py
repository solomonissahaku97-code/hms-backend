"""StockRequest model - department stock requests."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils.types import RequestStatus, Priority


class StockRequest(Base):
    __tablename__ = "stock_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(UUID(as_uuid=True), nullable=True)
    request_number = Column(String(50), unique=True, nullable=False)
    requested_by = Column(UUID(as_uuid=True), nullable=True)
    department_id = Column(UUID(as_uuid=True), nullable=True)
    priority = Column(Enum(Priority), default=Priority.MEDIUM)
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING)
    request_date = Column(DateTime(timezone=True), default=datetime.utcnow)
    required_date = Column(DateTime(timezone=True), nullable=True)
    purpose = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    approved_by = Column(UUID(as_uuid=True), nullable=True)
    approved_date = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    created_at = Column("createdAt", DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
