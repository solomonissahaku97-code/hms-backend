"""StockTransfer model - inter-department transfers."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils.types import TransferStatus


class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transfer_number = Column(String(50), unique=True, nullable=False)
    from_department_id = Column(UUID(as_uuid=True), nullable=False)
    to_department_id = Column(UUID(as_uuid=True), nullable=False)
    transferred_by = Column(UUID(as_uuid=True), nullable=False)
    received_by = Column(UUID(as_uuid=True), nullable=True)
    institution_id = Column(UUID(as_uuid=True), nullable=True)
    transfer_date = Column(DateTime(timezone=True), default=datetime.utcnow)
    receive_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(TransferStatus), default=TransferStatus.PENDING)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
