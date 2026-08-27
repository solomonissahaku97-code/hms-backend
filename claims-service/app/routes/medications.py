"""NHIA Medication routes."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.medication import (
    MedicationCreate, MedicationUpdate, MedicationResponse, MedicationListResponse,
)
from app.services.medication_service import MedicationService

router = APIRouter()


@router.post("/", response_model=MedicationResponse, status_code=201)
async def create_medication(
    data: MedicationCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = MedicationService(db)
    try:
        med = await service.create_medication(data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return med


@router.get("/", response_model=MedicationListResponse)
async def list_medications(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = MedicationService(db)
    meds, total = await service.list_medications(search=search, page=page, limit=limit)
    return MedicationListResponse(
        total=total, page=page, pages=-(-total // limit), data=meds,
    )


@router.get("/{code}", response_model=list[MedicationResponse])
async def search_medications(
    code: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = MedicationService(db)
    meds, _ = await service.list_medications(search=code, limit=50)
    return meds


@router.put("/{code}", response_model=MedicationResponse)
async def update_medication(
    code: str,
    data: MedicationUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = MedicationService(db)
    med = await service.update_medication(code, data)
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    await db.commit()
    return med


@router.delete("/{code}")
async def delete_medication(
    code: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = MedicationService(db)
    deleted = await service.delete_medication(code)
    if not deleted:
        raise HTTPException(status_code=404, detail="Medication not found")
    await db.commit()
    return {"message": "Medication deleted successfully"}
