"""SystemDiagnosis model - ICD-10 diagnosis catalog."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SystemDiagnosis(Base):
    __tablename__ = "system_diagnosis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    icd_10_code = Column(String(50), nullable=False, index=True)
    diagnosis_name = Column(String(500), nullable=False)
    gender = Column(String(20), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
