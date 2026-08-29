"""Payment model - records every payment transaction.
Aligned with the monolith's payments table schema."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column("transactionId", String(100), nullable=True, index=True)

    # Links
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True, index=True)
    service_bill_id = Column(UUID(as_uuid=True), ForeignKey("service_bills.id"), nullable=True, index=True)
    patient_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)

    # Payment details
    amount = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(10), nullable=True)
    payment_method = Column(String(50), nullable=True)
    payment_type = Column(String(50), nullable=True)

    # Status
    status = Column(String(50), nullable=True, index=True)

    # Dates (DB uses camelCase)
    paid_at = Column("paidAt", DateTime(timezone=True), nullable=True)
    created_at = Column("createdAt", DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Notes
    notes = Column(Text, nullable=True)

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
    service_bill = relationship("ServiceBill", back_populates="payments")
