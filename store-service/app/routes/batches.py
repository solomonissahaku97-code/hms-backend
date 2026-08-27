"""Batch routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.store import BatchCreate, BatchResponse, AdjustmentCreate, IssueItemsRequest
from app.services.batch_service import BatchService

router = APIRouter()


@router.post("/", response_model=BatchResponse, status_code=201)
async def create_batch(data: BatchCreate, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = BatchService(db)
    batch = await service.create_batch(data)
    await db.commit()
    return batch


@router.get("/")
async def list_batches(
    institution_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    low_stock: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = BatchService(db)
    batches = await service.list_batches(institution_id=institution_id, search=search, low_stock=low_stock)
    return {"batches": batches, "count": len(batches)}


@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(batch_id: UUID, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = BatchService(db)
    batch = await service.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/issue")
async def issue_items(data: IssueItemsRequest, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = BatchService(db)
    try:
        results = await service.issue_items(
            items=[item.model_dump() for item in data.items],
            department_id=data.department_id,
            issued_by=data.issued_by,
            institution_id=data.institution_id,
        )
        await db.commit()
        return {"message": f"Issued {len(results)} items", "count": len(results)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/adjust")
async def adjust_stock(data: AdjustmentCreate, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = BatchService(db)
    try:
        adjustment = await service.adjust_stock(
            batch_id=data.batch_id,
            adjustment_type=data.adjustment_type,
            quantity=data.quantity,
            reason=data.reason or "",
            adjusted_by=data.adjusted_by or user.id,
            institution_id=data.institution_id,
        )
        await db.commit()
        return {"message": "Stock adjusted", "adjustment_id": str(adjustment.id)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
