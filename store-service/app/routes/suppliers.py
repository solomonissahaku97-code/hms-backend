"""Supplier routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.store import SupplierCreate, SupplierResponse
from app.services.supplier_service import SupplierService

router = APIRouter()


@router.post("/", response_model=SupplierResponse, status_code=201)
async def create_supplier(data: SupplierCreate, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = SupplierService(db)
    supplier = await service.create_supplier(data)
    await db.commit()
    return supplier


@router.get("/")
async def list_suppliers(
    institution_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = SupplierService(db)
    suppliers = await service.list_suppliers(institution_id=institution_id, search=search)
    return suppliers


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(supplier_id: UUID, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = SupplierService(db)
    supplier = await service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(supplier_id: UUID, data: dict, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = SupplierService(db)
    supplier = await service.update_supplier(supplier_id, data)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    await db.commit()
    return supplier


@router.delete("/{supplier_id}")
async def deactivate_supplier(supplier_id: UUID, db: AsyncSession = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    service = SupplierService(db)
    deleted = await service.deactivate_supplier(supplier_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Supplier not found")
    await db.commit()
    return {"message": "Supplier deactivated"}
