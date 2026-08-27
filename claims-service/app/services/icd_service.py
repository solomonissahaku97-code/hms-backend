"""ICD-10 and GDRG service."""

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_diagnosis import SystemDiagnosis
from app.models.gdrg_code import GDRGCode
from app.models.icd10_gdrg import ICD10ToGDRG
from app.schemas.gdrg import (
    SystemDiagnosisCreate, GDRGCodeCreate, GDRGCodeUpdate,
    ICD10ToGDRGCreate,
)


class ICDService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── ICD-10 Diagnoses ───────────────────────────────────────────────

    async def create_diagnosis(self, data: SystemDiagnosisCreate) -> SystemDiagnosis:
        existing = await self.db.execute(
            select(SystemDiagnosis).where(SystemDiagnosis.icd_10_code == data.icd_10_code)
        )
        if existing.scalar_one_or_none():
            raise ValueError("Diagnosis with this ICD-10 code already exists")

        diagnosis = SystemDiagnosis(**data.model_dump())
        self.db.add(diagnosis)
        await self.db.flush()
        return diagnosis

    async def get_diagnosis(self, diagnosis_id: UUID) -> Optional[SystemDiagnosis]:
        result = await self.db.execute(
            select(SystemDiagnosis).where(SystemDiagnosis.id == diagnosis_id)
        )
        return result.scalar_one_or_none()

    async def list_diagnoses(
        self, search: Optional[str] = None, gender: Optional[str] = None,
        limit: int = 50, offset: int = 0,
    ) -> Tuple[List[SystemDiagnosis], int]:
        query = select(SystemDiagnosis)
        count_query = select(func.count(SystemDiagnosis.id))
        conditions = []

        if search:
            conditions.append(
                SystemDiagnosis.icd_10_code.ilike(f"%{search}%")
                | SystemDiagnosis.diagnosis_name.ilike(f"%{search}%")
            )
        if gender:
            conditions.append(SystemDiagnosis.gender == gender)

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        total = (await self.db.execute(count_query)).scalar() or 0
        query = query.order_by(SystemDiagnosis.diagnosis_name).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def update_diagnosis(self, diagnosis_id: UUID, data: dict) -> Optional[SystemDiagnosis]:
        diagnosis = await self.get_diagnosis(diagnosis_id)
        if not diagnosis:
            return None
        for key, value in data.items():
            if value is not None:
                setattr(diagnosis, key, value)
        return diagnosis

    async def delete_diagnosis(self, diagnosis_id: UUID) -> bool:
        diagnosis = await self.get_diagnosis(diagnosis_id)
        if not diagnosis:
            return False
        await self.db.delete(diagnosis)
        return True

    # ── GDRG Codes ─────────────────────────────────────────────────────

    async def create_gdrg_code(self, data: GDRGCodeCreate) -> GDRGCode:
        code = GDRGCode(**data.model_dump())
        self.db.add(code)
        await self.db.flush()
        return code

    async def get_gdrg_code(self, code_id: UUID) -> Optional[GDRGCode]:
        result = await self.db.execute(
            select(GDRGCode).where(GDRGCode.id == code_id)
        )
        return result.scalar_one_or_none()

    async def list_gdrg_codes(self, search: Optional[str] = None) -> List[GDRGCode]:
        query = select(GDRGCode)
        if search:
            query = query.where(
                GDRGCode.code.ilike(f"%{search}%")
                | GDRGCode.description.ilike(f"%{search}%")
            )
        query = query.order_by(GDRGCode.code)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_gdrg_code(self, code_id: UUID, data: GDRGCodeUpdate) -> Optional[GDRGCode]:
        code = await self.get_gdrg_code(code_id)
        if not code:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(code, key, value)
        return code

    async def delete_gdrg_code(self, code_id: UUID) -> bool:
        code = await self.get_gdrg_code(code_id)
        if not code:
            return False
        await self.db.delete(code)
        return True

    # ── ICD-10 to GDRG Mappings ────────────────────────────────────────

    async def create_mapping(self, data: ICD10ToGDRGCreate) -> ICD10ToGDRG:
        mapping = ICD10ToGDRG(**data.model_dump())
        self.db.add(mapping)
        await self.db.flush()
        return mapping

    async def list_mappings(self) -> List[ICD10ToGDRG]:
        result = await self.db.execute(select(ICD10ToGDRG))
        return list(result.scalars().all())

    async def delete_mapping(self, gdrg_code: str) -> bool:
        result = await self.db.execute(
            select(ICD10ToGDRG).where(ICD10ToGDRG.gdrg_code == gdrg_code)
        )
        mapping = result.scalar_one_or_none()
        if not mapping:
            return False
        await self.db.delete(mapping)
        return True

    async def update_mapping(self, gdrg_code: str, data: ICD10ToGDRGCreate) -> Optional[ICD10ToGDRG]:
        result = await self.db.execute(
            select(ICD10ToGDRG).where(ICD10ToGDRG.gdrg_code == gdrg_code)
        )
        mapping = result.scalar_one_or_none()
        if not mapping:
            return None
        for key, value in data.model_dump().items():
            setattr(mapping, key, value)
        return mapping
