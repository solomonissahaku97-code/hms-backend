"""ClaimBatch model - groups claims for bulk NHIA submission."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils.types import BatchStatus


class ClaimBatch(Base):
    __tablename__ = "claim_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_number = Column(String(100), unique=True, nullable=False)
    total_amount = Column(Float, default=0)
    claim_count = Column(Integer, default=0)
    status = Column(
        Enum(BatchStatus, name="batch_status_enum", create_constraint=False),
        default=BatchStatus.DRAFT,
    )
    submission_date = Column(DateTime(timezone=True), default=datetime.utcnow)
    institution_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
