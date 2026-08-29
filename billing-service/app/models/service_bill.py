"""ServiceBill model - individual billable line item linked to an invoice.
Aligned with the monolith's service_bills table schema."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ServiceBill(Base):
    __tablename__ = "service_bills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Links
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True, index=True)
    visit_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    patient_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    institution_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    department_id = Column(UUID(as_uuid=True), nullable=True)

    # Service reference
    service_id = Column(UUID(as_uuid=True), nullable=True)
    service_type = Column(String(50), nullable=True, index=True)
    description = Column(String(500), nullable=True)

    # Pricing
    unit_price = Column(Numeric(15, 2), nullable=True, default=0)
    quantity = Column(Integer, default=1)
    total_amount = Column(Numeric(15, 2), nullable=True, default=0)

    # NHIA split
    nhia_amount = Column(Numeric(15, 2), default=0)
    patient_amount = Column(Numeric(15, 2), nullable=True, default=0)

    # Staff references (matching monolith's admin_id/staff_id)
    admin_id = Column(UUID(as_uuid=True), nullable=True)
    staff_id = Column(UUID(as_uuid=True), nullable=True)

    # Payment
    has_paid = Column(Boolean, default=False)
    payment_status = Column(String(20), default="Pending")
    is_nhia_covered = Column(Boolean, default=False)

    # Audit
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    invoice = relationship("Invoice", back_populates="service_bills")
    payments = relationship("Payment", back_populates="service_bill", lazy="selectin")

    def compute_amounts(self):
        """Compute total from unit_price * quantity."""
        self.total_amount = float(self.unit_price or 0) * int(self.quantity or 1)
        self.patient_amount = float(self.total_amount) - float(self.nhia_amount or 0)
        if self.patient_amount < 0:
            self.patient_amount = 0
