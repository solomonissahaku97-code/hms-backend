"""Financial report API routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.services.report_service import ReportService

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    institution_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get comprehensive billing dashboard."""
    service = ReportService(db)
    return await service.get_dashboard(institution_id)


@router.get("/revenue")
async def get_revenue_report(
    institution_id: UUID = Query(...),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get revenue report for the last N days."""
    service = ReportService(db)
    return await service.get_revenue_report(institution_id, days)


@router.get("/outstanding")
async def get_outstanding_balances(
    institution_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get outstanding balance report with aging."""
    service = ReportService(db)
    return await service.get_outstanding_balances(institution_id)


@router.get("/nhia-summary")
async def get_nhia_summary(
    institution_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get NHIA claims summary."""
    service = ReportService(db)
    return await service.get_nhia_summary(institution_id)
