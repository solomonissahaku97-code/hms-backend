from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Ultrasound
from app.schemas.maternity import UltrasoundCreate, UltrasoundResponse
from app.middleware.auth import authenticate

router = APIRouter(prefix="/api/v1/maternity", tags=["Ultrasound"])

@router.post("/ultrasound", response_model=UltrasoundResponse)
async def create_ultrasound(data: UltrasoundCreate, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    us = Ultrasound(**data.model_dump())
    db.add(us)
    await db.commit()
    await db.refresh(us)
    return us

@router.get("/ultrasound", response_model=list[UltrasoundResponse])
async def list_ultrasounds(visit_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    q = select(Ultrasound)
    if visit_id: q = q.where(Ultrasound.visit_id == visit_id)
    result = await db.execute(q.order_by(Ultrasound.created_at.desc()))
    return result.scalars().all()

@router.get("/ultrasound/{us_id}", response_model=UltrasoundResponse)
async def get_ultrasound(us_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    result = await db.execute(select(Ultrasound).where(Ultrasound.id == us_id))
    us = result.scalar_one_or_none()
    if not us: raise HTTPException(status_code=404, detail="Ultrasound not found")
    return us
