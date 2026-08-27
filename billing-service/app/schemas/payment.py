"""Pydantic schemas for Payment operations."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    invoice_id: Optional[UUID] = None
    service_bill_id: Optional[UUID] = None
    patient_id: UUID
    institution_id: UUID
    amount: float = Field(gt=0)
    payment_method: str  # cash, mobile_money, insurance, nhia, etc.
    payment_type: str = "full"  # full, partial, nhis
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None


class PaymentResponse(BaseModel):
    id: UUID
    transaction_id: str
    invoice_id: Optional[UUID]
    service_bill_id: Optional[UUID]
    patient_id: UUID
    amount: float
    currency: str
    payment_method: str
    payment_type: str
    status: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
