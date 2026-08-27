"""Stock transfer routes."""

from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.models.stock_transfer import StockTransfer
from app.models.stock_transfer_item import StockTransferItem
from app.schemas.store import TransferCreate, TransferResponse

router = APIRouter()


@router.post("/", response_model=TransferResponse, status_code=201)
async def create_transfer(data: TransferCreate, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    transfer_number = f"TRF-{uuid4().hex[:8].upper()}"
    transfer = StockTransfer(
        id=uuid4(),
        institution_id=data.institution_id,
        transfer_number=transfer_number,
        from_department_id=data.from_department_id,
        to_department_id=data.to_department_id,
        transferred_by=data.transferred_by,
        notes=data.notes,
    )
    db.add(transfer)

    for item in data.items:
        tr_item = StockTransferItem(
            id=uuid4(),
            stock_transfer_id=transfer.id,
            item_id=item.item_id,
            batch_id=item.batch_id,
            quantity=item.quantity,
        )
        db.add(tr_item)

    await db.commit()
    return transfer


@router.get("/")
async def list_transfers(
    institution_id: Optional[UUID] = Query(None),
    from_department_id: Optional[UUID] = Query(None),
    to_department_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    query = select(StockTransfer)
    if institution_id:
        query = query.where(StockTransfer.institution_id == institution_id)
    if from_department_id:
        query = query.where(StockTransfer.from_department_id == from_department_id)
    if to_department_id:
        query = query.where(StockTransfer.to_department_id == to_department_id)
    if status:
        query = query.where(StockTransfer.status == status)
    query = query.order_by(StockTransfer.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


@router.put("/{transfer_id}/complete")
async def complete_transfer(transfer_id: UUID, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    result = await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    transfer.status = "completed"
    transfer.received_by = user.id
    transfer.receive_date = __import__("datetime").datetime.utcnow()
    await db.commit()
    return {"message": "Transfer completed"}
