"""ICD10ToGDRG model - maps ICD-10 codes to GDRG codes."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID, ARRAY as PG_ARRAY

from app.database import Base


class ICD10ToGDRG(Base):
    __tablename__ = "icd10_to_gdrg"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gdrg_code = Column(String(100), nullable=False)
    gdrg_description = Column(String(500), nullable=False)
    condition = Column(String(500), default="None")
    icd10_codes = Column(PG_ARRAY(String), nullable=False)
    icd10_diagnoses = Column(PG_ARRAY(String), nullable=False)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
