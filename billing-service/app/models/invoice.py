"""Invoice model - financial document per patient visit.
Aligned with the monolith's invoices table schema."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, DateTime, Enum, Numeric, String, Text, Boolean,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.types import InvoiceStatus


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(255), unique=True, nullable=False, index=True)

    # References (matching monolith schema exactly)
    patient_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    visit_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    institution_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Dates
    invoice_date = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Financial — all double precision in DB, use Numeric for Python
    subtotal = Column(Numeric(15, 2), default=0, nullable=False)
    tax_amount = Column(Numeric(15, 2), default=0, nullable=False)
    discount_amount = Column(Numeric(15, 2), default=0, nullable=False)
    total_amount = Column(Numeric(15, 2), default=0, nullable=False)
    amount_paid = Column(Numeric(15, 2), default=0, nullable=False)
    balance_due = Column(Numeric(15, 2), default=0, nullable=False)

    # Status
    status = Column(String(50), default="draft", index=True)
    payment_method = Column(String(50), nullable=True)

    # Metadata
    notes = Column(Text, nullable=True)
    metadata_ = Column("metadata", Text, nullable=True)

    # Audit
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Invoice sharing
    token = Column(String(255), nullable=True)
    sms_sent = Column(Boolean, default=False, nullable=False)
    sms_sent_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    paid_by = Column(UUID(as_uuid=True), nullable=True)
    viewed_count = Column(Numeric, default=0, nullable=False)
    viewed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    service_bills = relationship("ServiceBill", back_populates="invoice", lazy="selectin")
    payments = relationship("Payment", back_populates="invoice", lazy="selectin")
    nhia_claims = relationship("NHIAClaim", back_populates="invoice")

    def compute_totals(self):
        """Recalculate totals from service bills and payments."""
        self.subtotal = sum(float(b.total_amount or 0) for b in self.service_bills)
        self.total_amount = float(self.subtotal) + float(self.tax_amount or 0) - float(self.discount_amount or 0)
        self.total_amount = round(self.total_amount, 2)
        self.amount_paid = sum(float(p.amount or 0) for p in self.payments if p.status == "completed")
        self.balance_due = max(0, self.total_amount - self.amount_paid)
        self.balance_due = round(self.balance_due, 2)
