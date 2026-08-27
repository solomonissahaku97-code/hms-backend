from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import ANC, DeliveryRegister, Partograph
from app.middleware.auth import authenticate
from datetime import datetime

router = APIRouter(prefix="/api/v1/maternity", tags=["Dashboard"])

@router.get("/dashboard")
async def get_dashboard(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    today = datetime.utcnow()
    start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    q_anc = select(func.count()).select_from(ANC)
    q_del = select(func.count()).select_from(DeliveryRegister)
    q_active = select(func.count()).select_from(ANC).where(ANC.status == "Active")
    q_high = select(func.count()).select_from(ANC).where(ANC.risk_level.in_(["High", "Very High"]))

    if institution_id:
        q_anc = q_anc.where(ANC.institution_id == institution_id)
        q_del = q_del.where(DeliveryRegister.institution_id == institution_id).where(DeliveryRegister.date_of_delivery >= start_of_month)
        q_active = q_active.where(ANC.institution_id == institution_id)
        q_high = q_high.where(ANC.institution_id == institution_id)

    anc_total = (await db.execute(q_anc)).scalar() or 0
    deliveries = (await db.execute(q_del)).scalar() or 0
    active = (await db.execute(q_active)).scalar() or 0
    high_risk = (await db.execute(q_high)).scalar() or 0

    return {
        "active_anc_patients": active,
        "deliveries_this_month": deliveries,
        "total_anc_records": anc_total,
        "high_risk_patients": high_risk,
    }
