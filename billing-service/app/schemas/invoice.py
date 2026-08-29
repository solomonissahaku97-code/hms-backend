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
    patient_id: Optional[UUID] = None
    visit_id: UUID
    institution_id: UUID

    subtotal: float = 0
    tax_amount: float = 0
    discount_amount: float = 0
    total_amount: float = 0
    amount_paid: float = 0
    balance_due: float = 0

    status: str = "draft"
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None

    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
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
