"""Pydantic schemas for NHIA Claim operations."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class NHIAClaimItemCreate(BaseModel):
    service_bill_id: Optional[UUID] = None
    item_type: str
    item_id: Optional[UUID] = None
    description: Optional[str] = None
    gdrg_code: Optional[str] = None
    unit_price: float = 0
    quantity: int = 1
    amount: float = 0
    nhia_amount: float = 0


class NHIAClaimCreate(BaseModel):
    patient_id: UUID
    visit_id: UUID
    institution_id: UUID
    invoice_id: Optional[UUID] = None
    nhia_patient_id: Optional[str] = None
    nhia_scheme: str = "NHIA"
    provider_code: Optional[str] = None
    notes: Optional[str] = None
    items: List[NHIAClaimItemCreate] = []


class NHIAClaimItemResponse(BaseModel):
    id: UUID
    item_type: str
    description: Optional[str]
    gdrg_code: Optional[str]
    amount: float
    nhia_amount: float
    is_approved: bool
    approved_amount: float
    rejection_reason: Optional[str]

    model_config = {"from_attributes": True}


class NHIAClaimResponse(BaseModel):
    id: UUID
    claim_reference: str
    patient_id: UUID
    visit_id: UUID
    institution_id: UUID
    invoice_id: Optional[UUID]
    status: str
    total_amount: float
    nhia_amount: float
    patient_amount: float
    nhia_patient_id: Optional[str]
    submitted_at: Optional[datetime]
    processed_at: Optional[datetime]
    approved_at: Optional[datetime]
    paid_at: Optional[datetime]
    rejection_reason: Optional[str]
    items: List[NHIAClaimItemResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class NHIAClaimListResponse(BaseModel):
    total: int
    page: int
    pages: int
    data: List[NHIAClaimResponse]
