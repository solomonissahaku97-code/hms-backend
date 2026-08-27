"""Service bill API routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.models.service_bill import ServiceBill
from app.schemas.service_bill import ServiceBillCreate, ServiceBillResponse

router = APIRouter()


@router.post("/", response_model=ServiceBillResponse, status_code=201)
async def create_service_bill(
    data: ServiceBillCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Create a new service bill (e.g., from pharmacy dispensing)."""
    bill = ServiceBill(
        invoice_id=data.invoice_id,
        visit_id=data.visit_id,
        patient_id=data.patient_id,
        institution_id=data.institution_id,
        department_id=data.department_id,
        service_id=data.service_id,
        service_type=data.service_type,
        description=data.description,
        unit_price=data.unit_price,
        quantity=data.quantity,
        nhia_amount=data.nhia_amount,
        claim_id=data.claim_id,
        prescription_id=data.prescription_id,
    )
    bill.compute_amounts()
    if bill.nhia_amount > 0:
        bill.is_nhia_covered = True

    db.add(bill)
    await db.commit()
    await db.refresh(bill)
    return bill


@router.get("/", response_model=dict)
async def list_service_bills(
    institution_id: Optional[UUID] = Query(None),
    patient_id: Optional[UUID] = Query(None),
    visit_id: Optional[UUID] = Query(None),
    service_type: Optional[str] = Query(None),
    invoice_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """List service bills with filters."""
    query = select(ServiceBill)
    count_query = select(func.count(ServiceBill.id))
    conditions = []

    if institution_id:
        conditions.append(ServiceBill.institution_id == institution_id)
    if patient_id:
        conditions.append(ServiceBill.patient_id == patient_id)
    if visit_id:
        conditions.append(ServiceBill.visit_id == visit_id)
    if service_type:
        conditions.append(ServiceBill.service_type == service_type)
    if invoice_id:
        conditions.append(ServiceBill.invoice_id == invoice_id)

    if conditions:
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(ServiceBill.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)

    return {
        "total": total,
        "page": page,
        "pages": -(-total // limit),
        "data": list(result.scalars().all()),
    }


@router.get("/{bill_id}", response_model=ServiceBillResponse)
async def get_service_bill(
    bill_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get a single service bill."""
    result = await db.execute(select(ServiceBill).where(ServiceBill.id == bill_id))
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Service bill not found")
    return bill
