"""ICD-10 diagnosis routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.gdrg import SystemDiagnosisCreate, SystemDiagnosisResponse
from app.services.icd_service import ICDService

router = APIRouter()


@router.post("/", response_model=SystemDiagnosisResponse, status_code=201)
async def create_diagnosis(
    data: SystemDiagnosisCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    try:
        diagnosis = await service.create_diagnosis(data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return diagnosis


@router.get("/", response_model=list[SystemDiagnosisResponse])
async def list_diagnoses(
    search: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    diagnoses, total = await service.list_diagnoses(search=search, gender=gender, limit=limit, offset=offset)
    return diagnoses


@router.get("/{diagnosis_id}", response_model=SystemDiagnosisResponse)
async def get_diagnosis(
    diagnosis_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    diagnosis = await service.get_diagnosis(diagnosis_id)
    if not diagnosis:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    return diagnosis


@router.put("/{diagnosis_id}", response_model=SystemDiagnosisResponse)
async def update_diagnosis(
    diagnosis_id: UUID,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    diagnosis = await service.update_diagnosis(diagnosis_id, data)
    if not diagnosis:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    await db.commit()
    return diagnosis


@router.delete("/{diagnosis_id}")
async def delete_diagnosis(
    diagnosis_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    deleted = await service.delete_diagnosis(diagnosis_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    await db.commit()
    return {"message": "Diagnosis deleted successfully"}
