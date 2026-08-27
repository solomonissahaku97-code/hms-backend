"""Lab Investigation service."""

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lab_investigation import LabInvestigation
from app.schemas.lab_investigation import LabInvestigationCreate, LabInvestigationUpdate


class LabInvestigationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: LabInvestigationCreate) -> LabInvestigation:
        existing = await self.db.execute(
            select(LabInvestigation).where(LabInvestigation.g_drg_code == data.g_drg_code)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"G-DRG code '{data.g_drg_code}' already exists")

        inv = LabInvestigation(**data.model_dump())
        self.db.add(inv)
        await self.db.flush()
        return inv

    async def get(self, inv_id: UUID) -> Optional[LabInvestigation]:
        result = await self.db.execute(
            select(LabInvestigation).where(LabInvestigation.id == inv_id)
        )
        return result.scalar_one_or_none()

    async def list_all(
        self, search: Optional[str] = None, page: int = 1, limit: int = 10,
    ) -> Tuple[List[LabInvestigation], int]:
        query = select(LabInvestigation)
        count_query = select(func.count(LabInvestigation.id))

        if search:
            cond = or_(
                LabInvestigation.test_description.ilike(f"%{search}%"),
                LabInvestigation.g_drg_code.ilike(f"%{search}%"),
            )
            query = query.where(cond)
            count_query = count_query.where(cond)

        total = (await self.db.execute(count_query)).scalar() or 0
        query = query.order_by(LabInvestigation.test_description).offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def update(self, inv_id: UUID, data: LabInvestigationUpdate) -> Optional[LabInvestigation]:
        inv = await self.get(inv_id)
        if not inv:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None:
                setattr(inv, key, value)
        return inv

    async def delete(self, inv_id: UUID) -> bool:
        inv = await self.get(inv_id)
        if not inv:
            return False
        await self.db.delete(inv)
        return True
