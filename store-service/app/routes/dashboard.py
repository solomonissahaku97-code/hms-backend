"""Dashboard routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.models.item import Item
from app.models.item_batch import ItemBatch
from app.models.stock_alert import StockAlert
from app.models.stock_request import StockRequest
from app.models.supplier import Supplier
from app.services.batch_service import BatchService

router = APIRouter()


@router.get("/overview")
async def get_overview(
    institution_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    conditions = []
    if institution_id:
        from sqlalchemy import and_
        conditions.append(Item.institution_id == institution_id)

    total_items = (await db.execute(select(func.count(Item.id)))).scalar() or 0
    total_suppliers = (await db.execute(select(func.count(Supplier.id)).where(Supplier.is_active == True))).scalar() or 0
    pending_requests = (await db.execute(select(func.count(StockRequest.id)).where(StockRequest.status == "pending"))).scalar() or 0
    low_stock = (await db.execute(select(func.count(StockAlert.id)).where(StockAlert.is_resolved == False))).scalar() or 0

    # Stock value
    batch_query = select(ItemBatch).where(ItemBatch.status == "active")
    if institution_id:
        batch_query = batch_query.where(ItemBatch.institution_id == institution_id)
    batches = (await db.execute(batch_query)).scalars().all()
    total_value = sum(float(b.current_quantity) * float(b.unit_cost) for b in batches)

    expired = (await db.execute(select(func.count(ItemBatch.id)).where(ItemBatch.status == "expired"))).scalar() or 0

    return {
        "total_items": total_items,
        "total_value": round(total_value, 2),
        "low_stock_alerts": low_stock,
        "pending_requests": pending_requests,
        "expired_items": expired,
        "total_suppliers": total_suppliers,
    }


@router.get("/valuation")
async def get_valuation(
    institution_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = BatchService(db)
    return await service.get_valuation(institution_id)
