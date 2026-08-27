"""NHISClaimExport model - tracks NHIA XML export batches."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.utils.types import ExportStatus


class NHISClaimExport(Base):
    __tablename__ = "nhis_claim_exports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_number = Column(String(100), unique=True, nullable=False)
    institution_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    total_claims = Column(Integer, default=0)
    total_amount = Column(Float, default=0)
    generated_by = Column(UUID(as_uuid=True), nullable=True)
    export_status = Column(
        Enum(ExportStatus, name="export_status_enum", create_constraint=False),
        default=ExportStatus.PENDING,
    )
    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
