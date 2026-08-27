"""Pydantic schemas for Store operations."""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.utils.types import ItemCategory, BatchStatus, RequestStatus, TransferStatus, Priority, AlertType


# ── Items ────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: ItemCategory
    unit_of_measure: str = "pieces"
    reorder_level: int = 10
    critical_level: int = 5
    supplier_id: Optional[UUID] = None
    institution_id: Optional[UUID] = None

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ItemCategory] = None
    unit_of_measure: Optional[str] = None
    reorder_level: Optional[int] = None
    critical_level: Optional[int] = None
    is_active: Optional[bool] = None

class ItemResponse(BaseModel):
    id: UUID
    institution_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    category: str
    unit_of_measure: str
    reorder_level: int
    critical_level: int
    is_active: bool
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

class ItemListResponse(BaseModel):
    items: List[ItemResponse]
    total: int
    page: int
    pages: int


# ── Item Batches ─────────────────────────────────────────────────

class BatchCreate(BaseModel):
    item_id: UUID
    batch_number: Optional[str] = None
    quantity: int
    unit_cost: float
    selling_price: Optional[float] = None
    supplier_id: UUID
    expiry_date: Optional[datetime] = None
    manufacture_date: Optional[datetime] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    institution_id: Optional[UUID] = None

class BatchResponse(BaseModel):
    id: UUID
    item_id: UUID
    batch_number: str
    quantity: int
    current_quantity: int
    unit_cost: float
    selling_price: Optional[float] = None
    expiry_date: Optional[datetime] = None
    supplier_id: UUID
    status: str
    location: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Suppliers ────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[str] = None
    rating: Optional[int] = None
    institution_id: Optional[UUID] = None

class SupplierResponse(BaseModel):
    id: UUID
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Stock Requests ───────────────────────────────────────────────

class StockRequestItemCreate(BaseModel):
    item_id: UUID
    quantity: int

class StockRequestCreate(BaseModel):
    department_id: UUID
    requested_by: Optional[UUID] = None
    priority: Priority = Priority.MEDIUM
    purpose: Optional[str] = None
    notes: Optional[str] = None
    items: List[StockRequestItemCreate] = []
    institution_id: Optional[UUID] = None

class StockRequestResponse(BaseModel):
    id: UUID
    request_number: str
    department_id: Optional[UUID] = None
    status: str
    priority: str
    request_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Stock Transfers ──────────────────────────────────────────────

class TransferItemCreate(BaseModel):
    item_id: UUID
    batch_id: Optional[UUID] = None
    quantity: int

class TransferCreate(BaseModel):
    from_department_id: UUID
    to_department_id: UUID
    transferred_by: UUID
    notes: Optional[str] = None
    items: List[TransferItemCreate] = []
    institution_id: Optional[UUID] = None

class TransferResponse(BaseModel):
    id: UUID
    transfer_number: str
    from_department_id: UUID
    to_department_id: UUID
    status: str
    transfer_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# ── Stock Adjustments ────────────────────────────────────────────

class AdjustmentCreate(BaseModel):
    item_id: UUID
    batch_id: UUID
    adjustment_type: str  # "increase" or "decrease"
    quantity: int
    reason: Optional[str] = None
    adjusted_by: Optional[UUID] = None
    institution_id: Optional[UUID] = None


# ── Issue Items ──────────────────────────────────────────────────

class IssueItem(BaseModel):
    item_id: UUID
    batch_id: UUID
    quantity: int

class IssueItemsRequest(BaseModel):
    department_id: UUID
    issued_by: UUID
    notes: Optional[str] = None
    items: List[IssueItem]
    institution_id: Optional[UUID] = None


# ── Dashboard ────────────────────────────────────────────────────

class StoreDashboard(BaseModel):
    total_items: int
    total_value: float
    low_stock_alerts: int
    pending_requests: int
    expired_items: int
    total_suppliers: int

class StockValuationItem(BaseModel):
    item_id: UUID
    item_name: Optional[str] = None
    batch_number: str
    quantity: int
    unit_cost: float
    total_value: float
    supplier: Optional[str] = None
    expiry_date: Optional[datetime] = None

class StockValuationResponse(BaseModel):
    items: List[StockValuationItem]
    total_value: float
