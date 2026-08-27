"""Claim Batch routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.nhia import BatchCreate, BatchResponse, BatchAddClaim
from app.services.batch_service import BatchService

router = APIRouter()


@router.post("/", response_model=BatchResponse, status_code=201)
async def create_batch(
    data: BatchCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = BatchService(db)
    batch = await service.create_batch(data.institution_id)
    await db.commit()
    return batch


@router.post("/add-claim")
async def add_claim_to_batch(
    data: BatchAddClaim,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = BatchService(db)
    try:
        batch = await service.add_claim_to_batch(data.batch_id, data.claim_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return {"message": "Claim added to batch", "batch_id": str(batch.id)}


@router.get("/institution/{institution_id}", response_model=list[BatchResponse])
async def get_batches_by_institution(
    institution_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = BatchService(db)
    return await service.get_batches_by_institution(institution_id)


@router.post("/submit")
async def submit_batch(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = BatchService(db)
    try:
        batch = await service.submit_batch(batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await db.commit()
    return {"message": "Batch submitted successfully", "batch_id": str(batch.id)}
