"""Medication service for NHIA medication catalog."""

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medication import Medication
from app.schemas.medication import MedicationCreate, MedicationUpdate


class MedicationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_medication(self, data: MedicationCreate) -> Medication:
        existing = await self.db.execute(
            select(Medication).where(Medication.code == data.code)
        )
        if existing.scalar_one_or_none():
            raise ValueError("Medication with this code already exists")

        med = Medication(**data.model_dump())
        self.db.add(med)
        await self.db.flush()
        return med

    async def get_medication_by_code(self, code: str) -> Optional[Medication]:
        result = await self.db.execute(
            select(Medication).where(Medication.code == code)
        )
        return result.scalar_one_or_none()

    async def list_medications(
        self, search: Optional[str] = None, page: int = 1, limit: int = 20,
    ) -> Tuple[List[Medication], int]:
        query = select(Medication)
        count_query = select(func.count(Medication.id))

        if search:
            from sqlalchemy import or_
            query = query.where(
                or_(
                    Medication.code.ilike(f"%{search}%"),
                    Medication.generic_name.ilike(f"%{search}%"),
                )
            )
            count_query = count_query.where(
                or_(
                    Medication.code.ilike(f"%{search}%"),
                    Medication.generic_name.ilike(f"%{search}%"),
                )
            )

        total = (await self.db.execute(count_query)).scalar() or 0
        query = query.order_by(Medication.code).offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def update_medication(self, code: str, data: MedicationUpdate) -> Optional[Medication]:
        med = await self.get_medication_by_code(code)
        if not med:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(med, key, value)
        return med

    async def delete_medication(self, code: str) -> bool:
        med = await self.get_medication_by_code(code)
        if not med:
            return False
        await self.db.delete(med)
        return True
