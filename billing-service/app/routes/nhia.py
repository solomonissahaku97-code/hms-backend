"""NHIA claim API routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.models.nhia_claim import NHIAClaim, NHIAClaimItem
from app.schemas.nhia import (
    NHIAClaimCreate, NHIAClaimResponse, NHIAClaimListResponse,
)
from app.utils.helpers import generate_claim_reference

router = APIRouter()


@router.post("/", response_model=NHIAClaimResponse, status_code=201)
async def create_claim(
    data: NHIAClaimCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Create a new NHIA claim with items."""
    claim_reference = generate_claim_reference()

    claim = NHIAClaim(
        claim_reference=claim_reference,
        patient_id=data.patient_id,
        visit_id=data.visit_id,
        institution_id=data.institution_id,
        invoice_id=data.invoice_id,
        nhia_patient_id=data.nhia_patient_id,
        nhia_scheme=data.nhia_scheme,
        provider_code=data.provider_code,
        notes=data.notes,
        status="draft",
        created_by=user.id,
    )
    db.add(claim)
    await db.flush()

    # Add claim items
    for item_data in data.items:
        item = NHIAClaimItem(
            claim_id=claim.id,
            service_bill_id=item_data.service_bill_id,
            item_type=item_data.item_type,
            item_id=item_data.item_id,
            description=item_data.description,
            gdrg_code=item_data.gdrg_code,
            unit_price=item_data.unit_price,
            quantity=item_data.quantity,
            amount=item_data.amount,
            nhia_amount=item_data.nhia_amount,
        )
        db.add(item)

    # Compute totals
    claim.total_amount = sum(i.amount for i in data.items)
    claim.nhia_amount = sum(i.nhia_amount for i in data.items)
    claim.patient_amount = claim.total_amount - claim.nhia_amount

    await db.commit()
    await db.refresh(claim)
    return claim


@router.get("/", response_model=NHIAClaimListResponse)
async def list_claims(
    institution_id: Optional[UUID] = Query(None),
    patient_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """List NHIA claims with filters."""
    query = select(NHIAClaim)
    count_query = select(func.count(NHIAClaim.id))
    conditions = []

    if institution_id:
        conditions.append(NHIAClaim.institution_id == institution_id)
    if patient_id:
        conditions.append(NHIAClaim.patient_id == patient_id)
    if status:
        conditions.append(NHIAClaim.status == status)

    if conditions:
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(NHIAClaim.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    claims = list(result.scalars().all())

    return NHIAClaimListResponse(
        total=total,
        page=page,
        pages=-(-total // limit),
        data=claims,
    )


@router.get("/{claim_id}", response_model=NHIAClaimResponse)
async def get_claim(
    claim_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get a single NHIA claim by ID."""
    result = await db.execute(select(NHIAClaim).where(NHIAClaim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="NHIA claim not found")
    return claim


@router.post("/{claim_id}/submit", response_model=NHIAClaimResponse)
async def submit_claim(
    claim_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Submit a draft claim for processing."""
    result = await db.execute(select(NHIAClaim).where(NHIAClaim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="NHIA claim not found")
    if claim.status != "draft":
        raise HTTPException(status_code=400, detail=f"Cannot submit claim in '{claim.status}' status")

    from datetime import datetime
    claim.status = "submitted"
    claim.submitted_at = datetime.utcnow()
    await db.commit()
    return claim


@router.post("/{claim_id}/approve", response_model=NHIAClaimResponse)
async def approve_claim(
    claim_id: UUID,
    approved_amount: float = Query(...),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Approve a submitted NHIA claim (partial or full)."""
    result = await db.execute(select(NHIAClaim).where(NHIAClaim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="NHIA claim not found")
    if claim.status not in ["submitted", "processing"]:
        raise HTTPException(status_code=400, detail=f"Cannot approve claim in '{claim.status}' status")

    from datetime import datetime
    claim.nhia_amount = approved_amount
    claim.patient_amount = float(claim.total_amount) - approved_amount
    claim.approved_at = datetime.utcnow()

    if approved_amount >= float(claim.total_amount):
        claim.status = "approved"
    else:
        claim.status = "partially_approved"

    await db.commit()
    return claim


@router.post("/{claim_id}/reject", response_model=NHIAClaimResponse)
async def reject_claim(
    claim_id: UUID,
    reason: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Reject an NHIA claim."""
    result = await db.execute(select(NHIAClaim).where(NHIAClaim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="NHIA claim not found")

    from datetime import datetime
    claim.status = "rejected"
    claim.rejection_reason = reason
    claim.rejected_at = datetime.utcnow()
    await db.commit()
    return claim
