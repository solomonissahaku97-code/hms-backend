"""Stock request routes."""

from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.models.stock_request import StockRequest
from app.models.stock_request_item import StockRequestItem
from app.schemas.store import StockRequestCreate, StockRequestResponse

router = APIRouter()


@router.post("/", response_model=StockRequestResponse, status_code=201)
async def create_request(data: StockRequestCreate, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    request_number = f"REQ-{uuid4().hex[:8].upper()}"
    request = StockRequest(
        id=uuid4(),
        institution_id=data.institution_id,
        request_number=request_number,
        requested_by=data.requested_by or user.id,
        department_id=data.department_id,
        priority=data.priority,
        purpose=data.purpose,
        notes=data.notes,
    )
    db.add(request)

    for item in data.items:
        req_item = StockRequestItem(
            id=uuid4(),
            stock_request_id=request.id,
            item_id=item.item_id,
            quantity_requested=item.quantity,
        )
        db.add(req_item)

    await db.commit()
    return request


@router.get("/")
async def list_requests(
    institution_id: Optional[UUID] = Query(None),
    department_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    query = select(StockRequest)
    if institution_id:
        query = query.where(StockRequest.institution_id == institution_id)
    if department_id:
        query = query.where(StockRequest.department_id == department_id)
    if status:
        query = query.where(StockRequest.status == status)
    query = query.order_by(StockRequest.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


@router.put("/{request_id}/approve")
async def approve_request(request_id: UUID, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    result = await db.execute(select(StockRequest).where(StockRequest.id == request_id))
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    request.status = "approved"
    request.approved_by = user.id
    request.approved_date = __import__("datetime").datetime.utcnow()
    await db.commit()
    return {"message": "Request approved"}


@router.put("/{request_id}/reject")
async def reject_request(request_id: UUID, reason: Optional[str] = None, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    result = await db.execute(select(StockRequest).where(StockRequest.id == request_id))
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    request.status = "rejected"
    request.rejection_reason = reason
    await db.commit()
    return {"message": "Request rejected"}
