from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import ANC, PregnancyTimeline, DeliveryRegister, PNC, Ultrasound, Partograph, MaternityAudit
from app.schemas.maternity import ANCCreate, ANCRegister, ANCResponse
from app.middleware.auth import authenticate
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/v1/maternity", tags=["ANC"])

@router.post("/anc", response_model=ANCResponse)
async def create_anc(data: ANCCreate, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    anc_number = f"ANC-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}"
    anc = ANC(**data.model_dump(), anc_number=anc_number, year=datetime.now().year, status="Active")
    db.add(anc)
    await db.commit()
    await db.refresh(anc)
    return anc

@router.post("/anc/register", response_model=ANCResponse)
async def register_anc(data: ANCRegister, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    anc_number = f"ANC-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}"
    anc = ANC(
        visit_id=uuid.uuid4(), institution_id=data.institution_id, auditor_id=data.auditor_id,
        gestational_age_weeks=data.gestational_age_weeks, mother_age=data.mother_age,
        parity=data.parity, blood_pressure=data.blood_pressure, hemoglobin_level=data.hemoglobin_level,
        hiv_status=data.hiv_status, anc_number=anc_number, year=datetime.now().year, status="Active"
    )
    db.add(anc)
    await db.commit()
    await db.refresh(anc)

    if data.lmp or data.edd:
        edd = data.edd or (data.lmp and __import__('datetime').date.fromordinal(data.lmp.toordinal() + 280))
        ga = data.gestational_age_weeks or 0
        timeline = PregnancyTimeline(
            visit_id=anc.visit_id, pregnancy_id=anc.id, lmp=data.lmp or datetime.now().date(),
            edd=edd, current_week=ga, total_weeks=40, progress_percent=(ga / 40) * 100
        )
        db.add(timeline)
        await db.commit()

    return anc

@router.get("/anc", response_model=list[ANCResponse])
async def list_anc(institution_id: str = None, status: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    q = select(ANC)
    if institution_id: q = q.where(ANC.institution_id == institution_id)
    if status: q = q.where(ANC.status == status)
    q = q.order_by(ANC.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()

@router.get("/anc/{anc_id}", response_model=ANCResponse)
async def get_anc(anc_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(ANC).where(ANC.id == anc_id))
    anc = result.scalar_one_or_none()
    if not anc: raise HTTPException(status_code=404, detail="ANC record not found")
    return anc

@router.put("/anc/{anc_id}", response_model=ANCResponse)
async def update_anc(anc_id: str, data: ANCCreate, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(ANC).where(ANC.id == anc_id))
    anc = result.scalar_one_or_none()
    if not anc: raise HTTPException(status_code=404, detail="ANC record not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(anc, k, v)
    await db.commit()
    await db.refresh(anc)
    return anc

@router.get("/anc/visit/{visit_id}", response_model=list[ANCResponse])
async def get_anc_by_visit(visit_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(ANC).where(ANC.visit_id == visit_id).order_by(ANC.created_at.asc()))
    return result.scalars().all()
