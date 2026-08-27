from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Partograph
from app.schemas.maternity import PartographCreate, PartographResponse
from app.middleware.auth import authenticate

router = APIRouter(prefix="/api/v1/maternity", tags=["Partograph"])

@router.post("/partograph", response_model=PartographResponse)
async def add_partograph(data: PartographCreate, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    risk_alerts = []
    alert = False
    action = False

    if data.fetal_heart_rate and (data.fetal_heart_rate < 110 or data.fetal_heart_rate > 160):
        risk_alerts.append({"type": "fetal_heart_rate", "message": f"FHR {data.fetal_heart_rate} bpm is abnormal"})
        alert = True
    if data.cervical_dilatation and data.cervical_dilatation >= 4:
        action = True
    if data.bp_systolic and data.bp_systolic > 140:
        risk_alerts.append({"type": "hypertension", "message": f"BP {data.bp_systolic}/{data.bp_diastolic} is elevated"})
        alert = True

    record = Partograph(
        visit_id=data.visit_id, cervical_dilatation=data.cervical_dilatation,
        fetal_heart_rate=data.fetal_heart_rate, contractions_frequency=data.contractions,
        pulse=data.maternal_pulse, bp_systolic=data.bp_systolic, bp_diastolic=data.bp_diastolic,
        remark=data.remark, alert=alert, action=action, risk_alerts=risk_alerts
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record

@router.get("/partograph/visit/{visit_id}", response_model=list[PartographResponse])
async def get_partograph_by_visit(visit_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(Partograph).where(Partograph.visit_id == visit_id).order_by(Partograph.record_time.asc()))
    return result.scalars().all()

@router.put("/partograph/{record_id}", response_model=PartographResponse)
async def update_partograph(record_id: str, data: PartographCreate, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(Partograph).where(Partograph.id == record_id))
    record = result.scalar_one_or_none()
    if not record: raise HTTPException(status_code=404, detail="Record not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(record, k, v)
    await db.commit()
    await db.refresh(record)
    return record

@router.delete("/partograph/{record_id}")
async def delete_partograph(record_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(Partograph).where(Partograph.id == record_id))
    record = result.scalar_one_or_none()
    if not record: raise HTTPException(status_code=404, detail="Record not found")
    await db.delete(record)
    await db.commit()
    return {"message": "Record deleted"}
