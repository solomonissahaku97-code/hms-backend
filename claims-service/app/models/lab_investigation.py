"""LabInvestigation model - lab test tariffs and pricing."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class LabInvestigation(Base):
    __tablename__ = "lab_investigations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_description = Column(String(500), nullable=False)
    g_drg_code = Column(String(50), nullable=False, unique=True, index=True)
    tariff_ghc = Column(Float, nullable=False)
    market_price = Column(Float, default=0)
    specimen_types = Column(JSON, default=list)
    turnaround_time_hours = Column(Integer, default=24)
    department_id = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
