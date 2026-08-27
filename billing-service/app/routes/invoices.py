"""Invoice API routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    InvoiceListResponse, InvoiceSummary,
)
from app.services.invoice_service import InvoiceService

router = APIRouter()


@router.post("/", response_model=InvoiceResponse, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Create a new invoice."""
    service = InvoiceService(db)
    invoice = await service.create_invoice(data, created_by=user.id)
    await db.commit()
    return invoice


@router.get("/", response_model=InvoiceListResponse)
async def list_invoices(
    institution_id: Optional[UUID] = Query(None),
    patient_id: Optional[UUID] = Query(None),
    visit_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """List invoices with filters and pagination."""
    service = InvoiceService(db)
    invoices, total = await service.list_invoices(
        institution_id=institution_id,
        patient_id=patient_id,
        visit_id=visit_id,
        status=status,
        page=page,
        limit=limit,
    )
    return InvoiceListResponse(
        total=total,
        page=page,
        pages=-(-total // limit),  # ceiling division
        data=invoices,
    )


@router.get("/summary", response_model=InvoiceSummary)
async def get_invoice_summary(
    institution_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get invoice summary stats for an institution."""
    service = InvoiceService(db)
    return await service.get_summary(institution_id)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get a single invoice by ID."""
    service = InvoiceService(db)
    invoice = await service.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: UUID,
    data: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Update invoice metadata."""
    service = InvoiceService(db)
    invoice = await service.update_invoice(invoice_id, data)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.commit()
    return invoice


@router.post("/{invoice_id}/finalize", response_model=InvoiceResponse)
async def finalize_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Move invoice from draft to pending (ready for payment)."""
    service = InvoiceService(db)
    try:
        invoice = await service.finalize_invoice(invoice_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    await db.commit()
    return invoice


@router.post("/{invoice_id}/bills", status_code=201)
async def add_service_bill(
    invoice_id: UUID,
    bill_data: dict,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Add a service bill line item to an invoice."""
    service = InvoiceService(db)
    try:
        bill = await service.add_service_bill(invoice_id, bill_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return {"id": str(bill.id), "total_amount": float(bill.total_amount)}
