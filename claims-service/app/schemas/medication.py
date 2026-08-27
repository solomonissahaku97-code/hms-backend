"""Pydantic schemas for NHIA Medication operations."""

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class MedicationCreate(BaseModel):
    code: str
    generic_name: str
    unit_of_pricing: str = "per unit"
    market_price: float = 0
    nhia_price: float = 0
    is_nhia_covered: bool = True
    level_of_prescribing: Optional[str] = None


class MedicationUpdate(BaseModel):
    generic_name: Optional[str] = None
    unit_of_pricing: Optional[str] = None
    market_price: Optional[float] = None
    nhia_price: Optional[float] = None
    is_nhia_covered: Optional[bool] = None
    level_of_prescribing: Optional[str] = None


class MedicationResponse(BaseModel):
    id: UUID
    code: Optional[str] = None
    generic_name: Optional[str] = None
    unit_of_pricing: str
    market_price: float = 0
    nhia_price: float = 0
    is_nhia_covered: bool = True
    level_of_prescribing: Optional[str] = None

    model_config = {"from_attributes": True}


class MedicationListResponse(BaseModel):
    total: int
    page: int
    pages: int
    data: List[MedicationResponse]
