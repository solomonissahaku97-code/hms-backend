"""Pydantic schemas for Claim operations."""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.utils.types import ClaimStatus, ClaimItemType


class ClaimItemCreate(BaseModel):
    item_type: ClaimItemType
    item_id: Optional[UUID] = None
    service_bill_id: Optional[UUID] = None
    gdrg_code: Optional[str] = None
    description: Optional[str] = None
    unit_price: Optional[float] = 0
    quantity: Optional[int] = 1
    nhia_amount: Optional[float] = 0
    performed_by: Optional[UUID] = None
    corresponding_diagnosis_id: Optional[UUID] = None


class ClaimItemResponse(BaseModel):
    id: UUID
    claim_id: UUID
    visit_id: Optional[UUID] = None
    item_type: str
    item_id: Optional[UUID] = None
    gdrg_code: Optional[str] = None
    description: Optional[str] = None
    unit_price: Optional[float] = None
    quantity: Optional[int] = None
    nhia_amount: float = 0
    actual_amount: float = 0
    co_payment: float = 0
    paid_by_patient: bool = False
    amount: float
    performed_by: Optional[UUID] = None
    date_performed: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ClaimCreate(BaseModel):
    visit_id: UUID


class ClaimResponse(BaseModel):
    id: UUID
    visit_id: UUID
    claim_status: str
    submission_date: Optional[datetime] = None
    total_amount: float = 0
    total_nhia_amount: float = 0
    total_patient_amount: float = 0
    claim_reference_number: str
    batch_id: Optional[UUID] = None
    items: List[ClaimItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ClaimListResponse(BaseModel):
    claims: List[ClaimResponse]
    pagination: Dict[str, int]


class ClaimStatusUpdate(BaseModel):
    claim_id: UUID
    claim_status: ClaimStatus


class ClaimStatusTransition(BaseModel):
    allowed: List[str]
    current: str
    requested: str


class ClaimDashboardSummary(BaseModel):
    total_claims: int
    total_amount: float
    status_breakdown: Dict[str, int]
