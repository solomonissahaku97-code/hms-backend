"""ServiceBill model - individual billable line item linked to an invoice."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Numeric, String, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.types import ServiceType


class ServiceBill(Base):
    __tablename__ = "service_bills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Links
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True, index=True)
    visit_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    institution_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    department_id = Column(UUID(as_uuid=True), nullable=True)

    # Service reference (polymorphic)
    service_id = Column(UUID(as_uuid=True), nullable=True)
    service_type = Column(Enum(ServiceType), nullable=False, index=True)
    description = Column(String(500), nullable=False)

    # Pricing
    unit_price = Column(Numeric(15, 2), nullable=False, default=0)
    quantity = Column(Integer, default=1)
    total_amount = Column(Numeric(15, 2), nullable=False, default=0)

    # NHIA split
    nhia_amount = Column(Numeric(15, 2), default=0)
    patient_amount = Column(Numeric(15, 2), nullable=False, default=0)
    is_nhia_covered = Column(Boolean, default=False)

    # Payment
    has_paid = Column(Boolean, default=False)
    payment_status = Column(String(20), default="Pending")  # Pending, Paid, Overdue
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # External references
    claim_id = Column(UUID(as_uuid=True), nullable=True)
    prescription_id = Column(UUID(as_uuid=True), nullable=True)

    # Metadata
    metadata_ = Column("metadata", JSONB, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    invoice = relationship("Invoice", back_populates="service_bills")
    payments = relationship("Payment", back_populates="service_bill", lazy="selectin")

    def compute_amounts(self):
        """Compute total and split NHIA/patient amounts."""
        self.total_amount = float(self.unit_price) * int(self.quantity or 1)
        self.patient_amount = float(self.total_amount) - float(self.nhia_amount or 0)
        if self.patient_amount < 0:
            self.patient_amount = 0
