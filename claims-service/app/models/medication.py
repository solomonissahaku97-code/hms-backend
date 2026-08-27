"""Medication model - NHIA medication catalog."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, String, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Medication(Base):
    __tablename__ = "medicines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=True, index=True)
    generic_name = Column(String(300), nullable=True)
    unit_of_pricing = Column(String(50), nullable=False, default="per unit")
    market_price = Column(Float, default=0)
    nhia_price = Column(Float, default=0)
    is_nhia_covered = Column(Boolean, default=True)
    level_of_prescribing = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
