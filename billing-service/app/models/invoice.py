"""Invoice model - financial document per patient visit."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, DateTime, Enum, ForeignKey, Numeric, String, Text, Boolean,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.types import InvoiceStatus, Currency


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)

    # External references (to main HMS)
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    visit_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    institution_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    department_id = Column(UUID(as_uuid=True), nullable=True)

    # Financial
    subtotal = Column(Numeric(15, 2), default=0, nullable=False)
    tax_amount = Column(Numeric(15, 2), default=0)
    discount_amount = Column(Numeric(15, 2), default=0)
    total_amount = Column(Numeric(15, 2), default=0, nullable=False)
    amount_paid = Column(Numeric(15, 2), default=0)
    balance_due = Column(Numeric(15, 2), default=0)
    currency = Column(Enum(Currency), default=Currency.GHS)

    # NHIA
    nhia_covered_amount = Column(Numeric(15, 2), default=0)
    patient_responsibility = Column(Numeric(15, 2), default=0)

    # Status & metadata
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT, index=True)
    notes = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Insurance info
    has_insurance = Column(Boolean, default=False)
    insurance_reference = Column(String(255), nullable=True)

    # Audit
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    service_bills = relationship("ServiceBill", back_populates="invoice", lazy="selectin")
    payments = relationship("Payment", back_populates="invoice", lazy="selectin")
    nhia_claims = relationship("NHIAClaim", back_populates="invoice", lazy="selectin")

    def compute_totals(self):
        """Recalculate totals from service bills and payments."""
        self.subtotal = sum(float(b.total_amount or 0) for b in self.service_bills)
        self.nhia_covered_amount = sum(float(b.nhia_amount or 0) for b in self.service_bills)
        self.patient_responsibility = sum(float(b.patient_amount or 0) for b in self.service_bills)

        # Total = subtotal + tax - discount
        self.total_amount = float(self.subtotal) + float(self.tax_amount or 0) - float(self.discount_amount or 0)
        self.total_amount = round(self.total_amount, 2)

        # Paid amount
        self.amount_paid = sum(
            float(p.amount or 0) for p in self.payments if p.status == "completed"
        )

        # Balance
        self.balance_due = max(0, self.total_amount - self.amount_paid)
        self.balance_due = round(self.balance_due, 2)

        # Update status
        if self.amount_paid <= 0:
            self.status = InvoiceStatus.PENDING
        elif self.amount_paid >= self.total_amount:
            self.status = InvoiceStatus.PAID
            self.paid_at = self.paid_at or datetime.utcnow()
        else:
            self.status = InvoiceStatus.PARTIALLY_PAID
