"""GDRG codes and ICD-10 to GDRG mapping routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.gdrg import (
    GDRGCodeCreate, GDRGCodeUpdate, GDRGCodeResponse,
    ICD10ToGDRGCreate, ICD10ToGDRGResponse,
)
from app.services.icd_service import ICDService

router = APIRouter()


# ── GDRG Codes ─────────────────────────────────────────────────────

@router.get("/gdrg-codes", response_model=list[GDRGCodeResponse])
async def list_gdrg_codes(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    return await service.list_gdrg_codes(search=search)


@router.post("/gdrg-codes", response_model=GDRGCodeResponse, status_code=201)
async def create_gdrg_code(
    data: GDRGCodeCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    code = await service.create_gdrg_code(data)
    await db.commit()
    return code


@router.get("/gdrg-codes/{code_id}", response_model=GDRGCodeResponse)
async def get_gdrg_code(
    code_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    code = await service.get_gdrg_code(code_id)
    if not code:
        raise HTTPException(status_code=404, detail="GDRG code not found")
    return code


@router.put("/gdrg-codes/{code_id}", response_model=GDRGCodeResponse)
async def update_gdrg_code(
    code_id: UUID,
    data: GDRGCodeUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    code = await service.update_gdrg_code(code_id, data)
    if not code:
        raise HTTPException(status_code=404, detail="GDRG code not found")
    await db.commit()
    return code


@router.delete("/gdrg-codes/{code_id}")
async def delete_gdrg_code(
    code_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    deleted = await service.delete_gdrg_code(code_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="GDRG code not found")
    await db.commit()
    return {"message": "GDRG code deleted"}


# ── ICD-10 to GDRG Mappings ────────────────────────────────────────

@router.get("/icd10-gdrg-mappings", response_model=list[ICD10ToGDRGResponse])
async def list_mappings(
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    return await service.list_mappings()


@router.post("/icd10-gdrg-mappings", response_model=ICD10ToGDRGResponse, status_code=201)
async def create_mapping(
    data: ICD10ToGDRGCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    mapping = await service.create_mapping(data)
    await db.commit()
    return mapping


@router.put("/icd10-gdrg-mappings/{gdrg_code}", response_model=ICD10ToGDRGResponse)
async def update_mapping(
    gdrg_code: str,
    data: ICD10ToGDRGCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    mapping = await service.update_mapping(gdrg_code, data)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    await db.commit()
    return mapping


@router.delete("/icd10-gdrg-mappings/{gdrg_code}")
async def delete_mapping(
    gdrg_code: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = ICDService(db)
    deleted = await service.delete_mapping(gdrg_code)
    if not deleted:
        raise HTTPException(status_code=404, detail="Mapping not found")
    await db.commit()
    return {"message": "Mapping deleted"}
