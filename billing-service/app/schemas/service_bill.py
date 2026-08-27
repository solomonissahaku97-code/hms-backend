"""Pydantic schemas for ServiceBill operations."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.utils.types import ServiceType


class ServiceBillCreate(BaseModel):
    invoice_id: Optional[UUID] = None
    visit_id: UUID
    patient_id: UUID
    institution_id: UUID
    department_id: Optional[UUID] = None
    service_id: Optional[UUID] = None
    service_type: ServiceType
    description: str
    unit_price: float
    quantity: int = 1
    nhia_amount: float = 0
    claim_id: Optional[UUID] = None
    prescription_id: Optional[UUID] = None


class ServiceBillResponse(BaseModel):
    id: UUID
    invoice_id: Optional[UUID]
    visit_id: UUID
    patient_id: UUID
    institution_id: UUID
    department_id: Optional[UUID]
    service_type: str
    description: str
    unit_price: float
    quantity: int
    total_amount: float
    nhia_amount: float
    patient_amount: float
    is_nhia_covered: bool
    has_paid: bool
    payment_status: str
    created_at: datetime

    model_config = {"from_attributes": True}
