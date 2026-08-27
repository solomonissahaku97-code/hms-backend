"""StockRequestItem model - individual items in requests."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class StockRequestItem(Base):
    __tablename__ = "stock_request_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stock_request_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    item_id = Column(UUID(as_uuid=True), nullable=False)
    quantity_requested = Column(Integer, nullable=False)
    quantity_issued = Column(Integer, default=0)
    status = Column(String(20), default="pending")

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
