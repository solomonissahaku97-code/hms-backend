from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.database import get_db
from app.models import DeliveryRegister
from app.middleware.auth import authenticate
from datetime import datetime

router = APIRouter(prefix="/api/v1/maternity", tags=["Dashboard"])

@router.get("/dashboard")
async def get_dashboard(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    today = datetime.utcnow()
    start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    results = {"active_anc_patients": 0, "deliveries_this_month": 0, "total_anc_records": 0, "high_risk_patients": 0}

    try:
        # Use raw SQL to avoid model/column mismatches with shared database
        # Total ANC records
        if institution_id:
            row = await db.execute(text("SELECT COUNT(*) FROM anc_records WHERE institution_id = :iid"), {"iid": institution_id})
        else:
            row = await db.execute(text("SELECT COUNT(*) FROM anc_records"))
        results["total_anc_records"] = row.scalar() or 0
    except Exception:
        pass

    try:
        # Active ANC (all records without 'Completed' status, or just count all)
        if institution_id:
            row = await db.execute(text("SELECT COUNT(*) FROM anc_records WHERE institution_id = :iid"), {"iid": institution_id})
        else:
            row = await db.execute(text("SELECT COUNT(*) FROM anc_records"))
        results["active_anc_patients"] = row.scalar() or 0
    except Exception:
        pass

    try:
        # Deliveries this month
        if institution_id:
            row = await db.execute(text("SELECT COUNT(*) FROM delivery_register WHERE institution_id = :iid AND date_of_delivery >= :start"), {"iid": institution_id, "start": start_of_month})
        else:
            row = await db.execute(text("SELECT COUNT(*) FROM delivery_register WHERE date_of_delivery >= :start"), {"start": start_of_month})
        results["deliveries_this_month"] = row.scalar() or 0
    except Exception:
        pass

    try:
        # High risk (try risk_level column, fallback to 0)
        if institution_id:
            row = await db.execute(text("SELECT COUNT(*) FROM anc_records WHERE institution_id = :iid AND risk_level IN ('High', 'Very High')"), {"iid": institution_id})
        else:
            row = await db.execute(text("SELECT COUNT(*) FROM anc_records WHERE risk_level IN ('High', 'Very High')"))
        results["high_risk_patients"] = row.scalar() or 0
    except Exception:
        results["high_risk_patients"] = 0

    return results
