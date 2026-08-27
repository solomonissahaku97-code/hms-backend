"""Lab Investigation routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.lab_investigation import (
    LabInvestigationCreate, LabInvestigationUpdate, LabInvestigationResponse,
    LabInvestigationListResponse,
)
from app.services.lab_investigation_service import LabInvestigationService

router = APIRouter()


@router.post("/", response_model=LabInvestigationResponse, status_code=201)
async def create_investigation(
    data: LabInvestigationCreate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = LabInvestigationService(db)
    try:
        inv = await service.create(data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return inv


@router.get("/", response_model=LabInvestigationListResponse)
async def list_investigations(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = LabInvestigationService(db)
    invs, total = await service.list_all(search=search, page=page, limit=limit)
    return LabInvestigationListResponse(
        total_items=total, total_pages=-(-total // limit),
        current_page=page, investigations=invs,
    )


@router.get("/{inv_id}", response_model=LabInvestigationResponse)
async def get_investigation(
    inv_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = LabInvestigationService(db)
    inv = await service.get(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Lab investigation not found")
    return inv


@router.put("/{inv_id}", response_model=LabInvestigationResponse)
async def update_investigation(
    inv_id: UUID,
    data: LabInvestigationUpdate,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = LabInvestigationService(db)
    inv = await service.update(inv_id, data)
    if not inv:
        raise HTTPException(status_code=404, detail="Lab investigation not found")
    await db.commit()
    return inv


@router.delete("/{inv_id}", status_code=204)
async def delete_investigation(
    inv_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    service = LabInvestigationService(db)
    deleted = await service.delete(inv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Lab investigation not found")
    await db.commit()
