"""GDRGCode model - Ghana DRG codes for claim pricing."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, String, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class GDRGCode(Base):
    __tablename__ = "gdrg_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), nullable=True, index=True)
    description = Column(String(500), nullable=False)
    condition = Column(String(500), nullable=True)
    category = Column(String(200), nullable=True)
    market_price = Column(Float, default=0)
    nhia_price = Column(Float, default=0)
    coverage_percentage = Column(Float, default=0)
    is_nhia_covered = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
