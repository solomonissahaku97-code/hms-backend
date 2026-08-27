"""Dashboard routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.services.claim_service import ClaimService

router = APIRouter()


@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get claim dashboard summary."""
    service = ClaimService(db)
    return await service.get_dashboard_summary()
