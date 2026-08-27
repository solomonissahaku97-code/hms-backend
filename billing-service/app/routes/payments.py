"""Payment API routes."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import PaymentService

router = APIRouter()


@router.post("/", response_model=PaymentResponse, status_code=201)
async def process_payment(
    data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Process a payment against an invoice or service bill."""
    service = PaymentService(db)
    try:
        payment = await service.process_payment(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return payment


@router.get("/", response_model=dict)
async def list_payments(
    institution_id: Optional[UUID] = Query(None),
    patient_id: Optional[UUID] = Query(None),
    invoice_id: Optional[UUID] = Query(None),
    payment_method: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """List payments with filters."""
    service = PaymentService(db)
    payments, total = await service.list_payments(
        institution_id=institution_id,
        patient_id=patient_id,
        invoice_id=invoice_id,
        payment_method=payment_method,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
    )
    return {
        "total": total,
        "page": page,
        "pages": -(-total // limit),
        "data": payments,
    }


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get a single payment by ID."""
    service = PaymentService(db)
    payment = await service.get_payment(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/{payment_id}/refund", response_model=PaymentResponse)
async def refund_payment(
    payment_id: UUID,
    reason: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Refund a completed payment."""
    service = PaymentService(db)
    try:
        payment = await service.refund_payment(payment_id, reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return payment
