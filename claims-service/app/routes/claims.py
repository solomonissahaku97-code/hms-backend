"""Claims API routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.claim import (
    ClaimCreate, ClaimResponse, ClaimListResponse,
    ClaimStatusUpdate, ClaimItemCreate, ClaimItemResponse,
)
from app.services.claim_service import ClaimService

router = APIRouter()


@router.post("/", response_model=ClaimResponse, status_code=201)
async def create_claim(
    data: ClaimCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Create a new claim for a visit."""
    service = ClaimService(db)
    claim = await service.create_claim(data.visit_id)
    await db.commit()
    return claim


@router.get("/", response_model=ClaimListResponse)
async def list_claims(
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """List claims with filters and pagination."""
    service = ClaimService(db)
    claims, total = await service.list_claims(
        status=status, start_date=start_date, end_date=end_date,
        page=page, limit=limit,
    )
    return ClaimListResponse(
        claims=claims,
        pagination={
            "currentPage": page,
            "totalPages": -(-total // limit),
            "totalItems": total,
            "itemsPerPage": limit,
        },
    )


@router.get("/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get a single claim by ID."""
    service = ClaimService(db)
    claim = await service.get_claim(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


@router.put("/update-claim-status", response_model=ClaimResponse)
async def update_claim_status(
    data: ClaimStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Update claim status with transition validation."""
    service = ClaimService(db)
    try:
        claim = await service.update_claim_status(data.claim_id, data.claim_status.value)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return claim


@router.post("/items", response_model=ClaimItemResponse, status_code=201)
async def add_claim_item(
    claim_id: UUID,
    data: ClaimItemCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Add an item to a claim."""
    service = ClaimService(db)
    try:
        item = await service.add_claim_item(claim_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return item


@router.delete("/items/{item_id}")
async def remove_claim_item(
    claim_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Remove a claim item."""
    service = ClaimService(db)
    try:
        await service.remove_claim_item(claim_id, item_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await db.commit()
    return {"message": "Claim item removed successfully"}


@router.put("/approve-batch")
async def approve_batch(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Approve all claims in a batch."""
    service = ClaimService(db)
    count = await service.approve_batch(batch_id)
    if count == 0:
        raise HTTPException(status_code=404, detail="No claims found in this batch")
    await db.commit()
    return {"message": f"Approved {count} claims in batch"}
