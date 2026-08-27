"""NHIA Claim models - insurance claim tracking."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, DateTime, Enum, ForeignKey, Numeric, String, Text, Integer, Boolean,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.types import ClaimStatus


class NHIAClaim(Base):
    __tablename__ = "nhia_claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_reference = Column(String(100), unique=True, nullable=False, index=True)

    # Links
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True, index=True)
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    visit_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    institution_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Claim details
    status = Column(Enum(ClaimStatus), default=ClaimStatus.DRAFT, index=True)
    total_amount = Column(Numeric(15, 2), default=0)
    nhia_amount = Column(Numeric(15, 2), default=0, comment="Amount NHIA approved/covered")
    patient_amount = Column(Numeric(15, 2), default=0, comment="Patient responsibility")

    # NHIA specifics
    nhia_patient_id = Column(String(100), nullable=True, comment="NHIA patient enrollment ID")
    nhia_scheme = Column(String(100), default="NHIA", comment="Insurance scheme type")
    provider_code = Column(String(50), nullable=True, comment="NHIA provider/facility code")

    # Dates
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)

    # Rejection / notes
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Audit
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    invoice = relationship("Invoice", back_populates="nhia_claims")
    items = relationship("NHIAClaimItem", back_populates="claim", lazy="selectin")


class NHIAClaimItem(Base):
    __tablename__ = "nhia_claim_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("nhia_claims.id"), nullable=False, index=True)

    # Reference to the service bill
    service_bill_id = Column(UUID(as_uuid=True), nullable=True)

    # Service details
    item_type = Column(String(50), nullable=False)  # Medication, LabTest, Procedure, etc.
    item_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(String(500), nullable=True)
    gdrg_code = Column(String(50), nullable=True, comment="GDRG tariff code")

    # Pricing
    unit_price = Column(Numeric(15, 2), default=0)
    quantity = Column(Integer, default=1)
    amount = Column(Numeric(15, 2), default=0)
    nhia_amount = Column(Numeric(15, 2), default=0)
    patient_amount = Column(Numeric(15, 2), default=0)

    # NHIA approval
    is_approved = Column(Boolean, default=False)
    approved_amount = Column(Numeric(15, 2), default=0)
    rejection_reason = Column(Text, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    claim = relationship("NHIAClaim", back_populates="items")
