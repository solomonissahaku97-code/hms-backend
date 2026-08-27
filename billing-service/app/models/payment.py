"""Payment model - records every payment transaction."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.types import PaymentStatus


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(String(100), unique=True, nullable=False, index=True)

    # Links
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True, index=True)
    service_bill_id = Column(UUID(as_uuid=True), ForeignKey("service_bills.id"), nullable=True, index=True)
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    institution_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Payment details
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(10), default="GHS")
    payment_method = Column(String(50), nullable=False)  # cash, mobile_money, insurance, etc.
    payment_type = Column(String(50), default="full")  # full, partial, nhis

    # Status
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, index=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # References
    reference_number = Column(String(255), nullable=True)  # external ref (mobile money txn ID, etc.)
    notes = Column(Text, nullable=True)

    # Insurance/NHIA specific
    nhia_claim_id = Column(UUID(as_uuid=True), nullable=True)
    insurance_provider = Column(String(255), nullable=True)
    insurance_policy_number = Column(String(100), nullable=True)

    # Audit
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Extra data
    extra_data = Column(JSONB, nullable=True)

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
    service_bill = relationship("ServiceBill", back_populates="payments")
