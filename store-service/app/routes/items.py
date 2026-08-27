"""Item routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.store import ItemCreate, ItemUpdate, ItemResponse, ItemListResponse
from app.services.item_service import ItemService

router = APIRouter()


@router.post("/", response_model=ItemResponse, status_code=201)
async def create_item(data: ItemCreate, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = ItemService(db)
    item = await service.create_item(data)
    await db.commit()
    return item


@router.get("/", response_model=ItemListResponse)
async def list_items(
    institution_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ItemService(db)
    items, total = await service.list_items(institution_id=institution_id, category=category, search=search, page=page, limit=limit)
    return ItemListResponse(items=items, total=total, page=page, pages=-(-total // limit))


@router.get("/low-stock")
async def get_low_stock(institution_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = ItemService(db)
    return await service.get_low_stock_items(institution_id)


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(item_id: UUID, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = ItemService(db)
    item = await service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/{item_id}", response_model=ItemResponse)
async def update_item(item_id: UUID, data: ItemUpdate, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = ItemService(db)
    item = await service.update_item(item_id, data)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.commit()
    return item


@router.delete("/{item_id}")
async def deactivate_item(item_id: UUID, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = ItemService(db)
    deleted = await service.deactivate_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.commit()
    return {"message": "Item deactivated"}
