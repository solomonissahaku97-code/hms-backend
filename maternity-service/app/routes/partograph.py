from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.middleware.auth import authenticate

router = APIRouter(prefix="/api/v1/maternity", tags=["Partograph"])

@router.post("/partograph")
async def add_partograph(data: dict, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Add partograph record — uses raw SQL for shared DB compatibility"""
    risk_alerts = []
    alert = False
    action = False

    fhr = data.get("fetal_heart_rate")
    if fhr and (fhr < 110 or fhr > 160):
        risk_alerts.append({"type": "fetal_heart_rate", "message": f"FHR {fhr} bpm is abnormal"})
        alert = True
    bp = data.get("bp_systolic")
    if bp and bp > 140:
        risk_alerts.append({"type": "hypertension", "message": f"BP {bp} is elevated"})
        alert = True

    try:
        await db.execute(text("""
            INSERT INTO partographs (id, visit_id, record_time, cervical_dilatation, fetal_heart_rate,
                contractions_frequency, pulse, blood_pressure, remarks, alert, action, risk_alerts,
                "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), :visit_id, NOW(), :cervical, :fhr, :contractions,
                :pulse, :bp, :remark, :alert, :action, :risk_alerts, NOW(), NOW())
        """), {
            "visit_id": data["visit_id"],
            "cervical": data.get("cervical_dilatation"),
            "fhr": fhr,
            "contractions": data.get("contractions"),
            "pulse": data.get("maternal_pulse"),
            "bp": data.get("bp_systolic"),
            "remark": data.get("remark"),
            "alert": alert,
            "action": action,
            "risk_alerts": __import__("json").dumps(risk_alerts),
        })
        await db.commit()
        return {"message": "Partograph record added", "alert": alert, "risk_alerts": risk_alerts}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/partograph/visit/{visit_id}")
async def get_partograph_by_visit(visit_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        result = await db.execute(
            text("SELECT * FROM partographs WHERE visit_id = :vid ORDER BY record_time ASC"),
            {"vid": visit_id}
        )
        rows = result.mappings().all()
        return [dict(r) for r in rows]
    except Exception:
        return []

@router.put("/partograph/{record_id}")
async def update_partograph(record_id: str, data: dict, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        await db.execute(
            text("UPDATE partographs SET cervical_dilatation = :cd, fetal_heart_rate = :fhr WHERE id = :id"),
            {"cd": data.get("cervical_dilatation"), "fhr": data.get("fetal_heart_rate"), "id": record_id}
        )
        await db.commit()
        return {"message": "Record updated"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/partograph/{record_id}")
async def delete_partograph(record_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        await db.execute(text("DELETE FROM partographs WHERE id = :id"), {"id": record_id})
        await db.commit()
        return {"message": "Record deleted"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
