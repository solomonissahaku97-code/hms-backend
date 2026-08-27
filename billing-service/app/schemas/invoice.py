"""Pydantic schemas for Invoice operations."""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.utils.types import InvoiceStatus, Currency


class ServiceBillBrief(BaseModel):
    id: UUID
    service_type: str
    description: str
    unit_price: float
    quantity: int
    total_amount: float
    nhia_amount: float = 0
    patient_amount: float = 0

    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    patient_id: UUID
    visit_id: UUID
    institution_id: UUID
    department_id: Optional[UUID] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    currency: Currency = Currency.GHS


class InvoiceUpdate(BaseModel):
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    discount_amount: Optional[float] = None
    tax_amount: Optional[float] = None


class InvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    patient_id: UUID
    visit_id: UUID
    institution_id: UUID
    department_id: Optional[UUID] = None

    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    amount_paid: float
    balance_due: float
    currency: str

    nhia_covered_amount: float
    patient_responsibility: float

    status: str
    has_insurance: bool
    notes: Optional[str] = None
    due_date: Optional[datetime] = None

    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    total: int
    page: int
    pages: int
    data: List[InvoiceResponse]


class InvoiceSummary(BaseModel):
    total_invoices: int
    total_amount: float
    total_paid: float
    total_outstanding: float
    nhia_covered: float
    by_status: Dict[str, int]
