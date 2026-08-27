"""PaymentMethod model - configured payment methods per institution."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Boolean, String, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class PaymentMethodRecord(Base):
    __tablename__ = "payment_method_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    name = Column(String(100), nullable=False)
    method_type = Column(String(50), nullable=False)  # cash, mobile_money, card, bank, insurance
    provider = Column(String(100), nullable=True)  # MTN, Vodafone, etc.
    is_active = Column(Boolean, default=True)
    config = Column(JSON, nullable=True, comment="Gateway-specific configuration")

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
