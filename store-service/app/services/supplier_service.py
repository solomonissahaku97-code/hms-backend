"""Supplier service."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.supplier import Supplier
from app.schemas.store import SupplierCreate


class SupplierService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_supplier(self, data: SupplierCreate) -> Supplier:
        supplier = Supplier(**data.model_dump())
        self.db.add(supplier)
        await self.db.flush()
        return supplier

    async def list_suppliers(
        self, institution_id: Optional[UUID] = None, search: Optional[str] = None,
    ) -> List[Supplier]:
        query = select(Supplier).where(Supplier.is_active == True)
        if institution_id:
            query = query.where(Supplier.institution_id == institution_id)
        if search:
            query = query.where(or_(
                Supplier.name.ilike(f"%{search}%"),
                Supplier.contact_person.ilike(f"%{search}%"),
            ))
        query = query.order_by(Supplier.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_supplier(self, supplier_id: UUID) -> Optional[Supplier]:
        result = await self.db.execute(select(Supplier).where(Supplier.id == supplier_id))
        return result.scalar_one_or_none()

    async def update_supplier(self, supplier_id: UUID, data: dict) -> Optional[Supplier]:
        supplier = await self.get_supplier(supplier_id)
        if not supplier:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(supplier, key, value)
        return supplier

    async def deactivate_supplier(self, supplier_id: UUID) -> bool:
        supplier = await self.get_supplier(supplier_id)
        if not supplier:
            return False
        supplier.is_active = False
        return True
