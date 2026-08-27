"""Pydantic schemas for Lab Investigation operations."""

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel


class LabInvestigationCreate(BaseModel):
    test_description: str
    g_drg_code: str
    tariff_ghc: float
    market_price: float = 0
    specimen_types: Optional[List[str]] = []
    turnaround_time_hours: int = 24
    department_id: Optional[UUID] = None


class LabInvestigationUpdate(BaseModel):
    test_description: Optional[str] = None
    g_drg_code: Optional[str] = None
    tariff_ghc: Optional[float] = None
    market_price: Optional[float] = None
    specimen_types: Optional[List[str]] = None
    turnaround_time_hours: Optional[int] = None


class LabInvestigationResponse(BaseModel):
    id: UUID
    test_description: str
    g_drg_code: str
    tariff_ghc: float
    market_price: float = 0
    specimen_types: Optional[Any] = None
    turnaround_time_hours: int = 24
    department_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LabInvestigationListResponse(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    investigations: List[LabInvestigationResponse]
