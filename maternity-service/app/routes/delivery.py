from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import DeliveryRegister, PNC
from app.schemas.maternity import DeliveryCreate, DeliveryResponse, PNCCreate, PNCResponse
from app.middleware.auth import authenticate
import uuid

router = APIRouter(prefix="/api/v1/maternity", tags=["Delivery & PNC"])

@router.post("/delivery", response_model=DeliveryResponse)
async def record_delivery(data: DeliveryCreate, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    delivery = DeliveryRegister(**data.model_dump())
    db.add(delivery)

    pnc_number = f"PNC-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}"
    from datetime import datetime
    pnc = PNC(
        visit_id=data.visit_id, institution_id=data.institution_id,
        pnc_number=pnc_number, year=datetime.now().year,
        mother_condition="Good", baby_condition="Healthy" if data.outcome == "Alive" else "Other",
        auditor_id=user.get("id", uuid.uuid4())
    )
    db.add(pnc)
    await db.commit()
    await db.refresh(delivery)
    return delivery

@router.get("/delivery", response_model=list[DeliveryResponse])
async def list_deliveries(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    q = select(DeliveryRegister)
    if institution_id: q = q.where(DeliveryRegister.institution_id == institution_id)
    q = q.order_by(DeliveryRegister.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()

@router.get("/delivery/{delivery_id}", response_model=DeliveryResponse)
async def get_delivery(delivery_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(DeliveryRegister).where(DeliveryRegister.id == delivery_id))
    d = result.scalar_one_or_none()
    if not d: raise HTTPException(status_code=404, detail="Delivery not found")
    return d

@router.post("/pnc", response_model=PNCResponse)
async def create_pnc(data: PNCCreate, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    pnc_number = f"PNC-{uuid.uuid4().hex[:8].upper()}"
    pnc = PNC(**data.model_dump(), pnc_number=pnc_number, year=2026)
    db.add(pnc)
    await db.commit()
    await db.refresh(pnc)
    return pnc

@router.get("/pnc", response_model=list[PNCResponse])
async def list_pnc(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    q = select(PNC)
    if institution_id: q = q.where(PNC.institution_id == institution_id)
    result = await db.execute(q.order_by(PNC.created_at.desc()))
    return result.scalars().all()
