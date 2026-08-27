"""ClaimItem model - individual line items in a claim."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, Integer, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.types import ClaimItemType


class ClaimItem(Base):
    __tablename__ = "claim_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False, index=True)
    visit_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    item_type = Column(Enum(ClaimItemType, name="claim_item_type_enum", create_constraint=False), nullable=False)
    item_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    service_bill_id = Column(UUID(as_uuid=True), nullable=True)
    gdrg_code = Column(String(50), nullable=True)
    description = Column(String(500), nullable=True)
    unit_price = Column(Float, nullable=True)
    quantity = Column(Integer, nullable=True, default=1)
    nhia_amount = Column(Float, nullable=True, default=0)
    actual_amount = Column(Float, nullable=True, default=0)
    co_payment = Column(Float, nullable=True, default=0)
    paid_by_patient = Column(Boolean, default=False)
    amount = Column(Float, nullable=False, default=0)
    performed_by = Column(UUID(as_uuid=True), nullable=True)
    corresponding_diagnosis_id = Column(UUID(as_uuid=True), nullable=True)
    date_performed = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Audit
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    claim = relationship("Claim", back_populates="items")

    def compute_amounts(self):
        """Auto-calculate amount from unit_price * quantity."""
        if not self.amount and self.unit_price:
            self.amount = float(self.unit_price) * (self.quantity or 1)
