"""Claim model - NHIA claim linked to a patient visit."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Claim(Base):
    __tablename__ = "claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    item_id = Column(UUID(as_uuid=True), nullable=True)

    # Use String instead of Enum to avoid mismatch between Python enum values
    # and PostgreSQL enum labels. The DB stores 'Pending', 'Draft', etc.
    claim_status = Column(String(50), default="Pending", index=True)

    submission_date = Column(DateTime(timezone=True), nullable=True)
    total_amount = Column(Float, default=0)
    total_nhia_amount = Column(Float, default=0, comment="Sum of NHIA-covered amounts")
    total_patient_amount = Column(Float, default=0, comment="Sum of patient co-payments")
    claim_reference_number = Column(String(255), nullable=False, index=True)
    batch_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    # Map to camelCase DB columns (Sequelize convention)
    created_at = Column("createdAt", DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column("updatedAt", DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    items = relationship("ClaimItem", back_populates="claim", lazy="selectin")

    def recompute_totals(self):
        """Recalculate totals from claim items."""
        self.total_amount = sum(float(i.amount or 0) for i in self.items)
        self.total_nhia_amount = sum(float(i.nhia_amount or 0) for i in self.items)
        self.total_patient_amount = sum(float(i.co_payment or 0) for i in self.items)
