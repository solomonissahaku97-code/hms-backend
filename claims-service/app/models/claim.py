"""Claim model - NHIA claim linked to a patient visit."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.types import ClaimStatus


class Claim(Base):
    __tablename__ = "claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    claim_status = Column(
        Enum(ClaimStatus, name="claim_status_enum", create_constraint=False),
        default=ClaimStatus.PENDING,
        index=True,
    )
    submission_date = Column(DateTime(timezone=True), nullable=True)
    total_amount = Column(Float, default=0)
    total_nhia_amount = Column(Float, default=0, comment="Sum of NHIA-covered amounts")
    total_patient_amount = Column(Float, default=0, comment="Sum of patient co-payments")
    claim_reference_number = Column(String(100), nullable=False, index=True)
    batch_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Audit
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = relationship("ClaimItem", back_populates="claim", lazy="selectin")

    def recompute_totals(self):
        """Recalculate totals from claim items."""
        self.total_amount = sum(float(i.amount or 0) for i in self.items)
        self.total_nhia_amount = sum(float(i.nhia_amount or 0) for i in self.items)
        self.total_patient_amount = sum(float(i.co_payment or 0) for i in self.items)
