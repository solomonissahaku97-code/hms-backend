from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.models import FluidMonitoring, FluidBalanceSummary
from app.schemas.maternity import FluidEntryCreate, FluidEntryResponse, FluidSummaryResponse
from app.middleware.auth import authenticate
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/v1/maternity", tags=["Fluid Monitoring"])

@router.post("/fluid", response_model=FluidEntryResponse)
async def add_fluid_entry(data: FluidEntryCreate, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    entry = FluidMonitoring(**data.model_dump(), recorded_at=data.recorded_at or datetime.utcnow())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Auto-update balance summary
    await _update_balance_summary(db, str(data.visit_id), str(data.institution_id))
    return entry

@router.get("/fluid", response_model=list[FluidEntryResponse])
async def list_fluid_entries(visit_id: str = None, institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    q = select(FluidMonitoring).where(FluidMonitoring.is_void == False)
    if visit_id: q = q.where(FluidMonitoring.visit_id == visit_id)
    if institution_id: q = q.where(FluidMonitoring.institution_id == institution_id)
    result = await db.execute(q.order_by(FluidMonitoring.recorded_at.desc()))
    return result.scalars().all()

@router.put("/fluid/{entry_id}", response_model=FluidEntryResponse)
async def update_fluid_entry(entry_id: str, data: FluidEntryCreate, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(FluidMonitoring).where(FluidMonitoring.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    await db.commit()
    await db.refresh(entry)
    return entry

@router.delete("/fluid/{entry_id}")
async def void_fluid_entry(entry_id: str, void_reason: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(FluidMonitoring).where(FluidMonitoring.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry: raise HTTPException(status_code=404, detail="Entry not found")
    entry.is_void = True
    entry.void_reason = void_reason
    entry.status = "voided"
    await db.commit()
    return {"message": "Entry voided"}

@router.get("/fluid/summary", response_model=FluidSummaryResponse)
async def get_fluid_summary(visit_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    summary = await _update_balance_summary(db, visit_id, None)
    if not summary: raise HTTPException(status_code=404, detail="No summary found")
    return summary

async def _update_balance_summary(db: AsyncSession, visit_id: str, institution_id: str):
    today = datetime.utcnow().date()
    next_day = today + timedelta(days=1)

    q = select(FluidMonitoring).where(
        FluidMonitoring.visit_id == visit_id,
        FluidMonitoring.is_void == False,
        FluidMonitoring.recorded_at >= datetime.combine(today, datetime.min.time()),
        FluidMonitoring.recorded_at < datetime.combine(next_day, datetime.min.time())
    )
    result = await db.execute(q)
    entries = result.scalars().all()

    totals = {"total_intake": 0, "total_output": 0, "oral_intake": 0, "iv_intake": 0,
              "other_intake": 0, "urine_output": 0, "stool_output": 0, "vomit_output": 0, "other_output": 0}

    for e in entries:
        amt = float(e.amount)
        if e.type == "intake":
            totals["total_intake"] += amt
            if e.category == "oral": totals["oral_intake"] += amt
            elif e.category == "iv": totals["iv_intake"] += amt
            else: totals["other_intake"] += amt
        else:
            totals["total_output"] += amt
            if e.category == "urine": totals["urine_output"] += amt
            elif e.category == "stool": totals["stool_output"] += amt
            elif e.category == "vomit": totals["vomit_output"] += amt
            else: totals["other_output"] += amt

    net = totals["total_intake"] - totals["total_output"]
    status = "balanced"
    if net > 1000 or net < -1000: status = "critical"
    elif net > 500: status = "positive_balance"
    elif net < -500: status = "negative_balance"

    from sqlalchemy.dialects.postgresql import insert as pg_insert
    stmt = pg_insert(FluidBalanceSummary).values(
        visit_id=visit_id, institution_id=institution_id or visit_id, summary_date=today,
        net_balance=net, status=status, **totals
    ).on_conflict_do_update(
        index_elements=["visit_id", "summary_date"],
        set_={**totals, "net_balance": net, "status": status, "updated_at": datetime.utcnow()}
    )
    await db.execute(stmt)
    await db.commit()

    result2 = await db.execute(select(FluidBalanceSummary).where(
        FluidBalanceSummary.visit_id == visit_id, FluidBalanceSummary.summary_date == today
    ))
    return result2.scalar_one_or_none()
