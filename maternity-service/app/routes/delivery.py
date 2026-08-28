from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.middleware.auth import authenticate
import uuid

router = APIRouter(prefix="/api/v1/maternity", tags=["Delivery & PNC"])

@router.post("/delivery")
async def record_delivery(data: dict, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        await db.execute(text("""
            INSERT INTO delivery_register (id, visit_id, institution_id, date_of_delivery, mode_of_delivery,
                presentation, baby_sex, birth_weight, apgar_score, outcome, complications, remarks,
                "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), :vid, :iid, :dod, :mod, :pres, :sex, :weight, :apgar::jsonb,
                :outcome, :complications, :remarks, NOW(), NOW())
        """), {
            "vid": data["visit_id"], "iid": data["institution_id"],
            "dod": data["date_of_delivery"], "mod": data["mode_of_delivery"],
            "pres": data.get("presentation"), "sex": data["baby_sex"],
            "weight": data.get("birth_weight"),
            "apgar": __import__("json").dumps(data.get("apgar_score", {})),
            "outcome": data["outcome"], "complications": data.get("complications"),
            "remarks": data.get("remarks"),
        })

        # Auto-create PNC record
        pnc_number = f"PNC-{uuid.uuid4().hex[:8].upper()}"
        await db.execute(text("""
            INSERT INTO pnc_records (id, visit_id, institution_id, pnc_number, year,
                mother_condition, baby_condition, follow_up_needed, auditor_id,
                "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), :vid, :iid, :pnc_num, :year, 'Good', :baby_cond,
                false, :auditor, NOW(), NOW())
        """), {
            "vid": data["visit_id"], "iid": data["institution_id"],
            "pnc_num": pnc_number, "year": 2026,
            "baby_cond": "Healthy" if data.get("outcome") == "Alive" else "Other",
            "auditor": str(user.get("id", str(uuid.uuid4()))),
        })

        await db.commit()
        return {"message": "Delivery recorded successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/delivery")
async def list_deliveries(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        if institution_id:
            result = await db.execute(
                text("SELECT * FROM delivery_register WHERE institution_id = :iid ORDER BY \"createdAt\" DESC"),
                {"iid": institution_id}
            )
        else:
            result = await db.execute(text("SELECT * FROM delivery_register ORDER BY \"createdAt\" DESC"))
        return [dict(r) for r in result.mappings().all()]
    except Exception:
        return []

@router.get("/delivery/{delivery_id}")
async def get_delivery(delivery_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        result = await db.execute(text("SELECT * FROM delivery_register WHERE id = :id"), {"id": delivery_id})
        row = result.mappings().first()
        if not row: raise HTTPException(status_code=404, detail="Delivery not found")
        return dict(row)
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/pnc")
async def create_pnc(data: dict, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        pnc_number = f"PNC-{uuid.uuid4().hex[:8].upper()}"
        await db.execute(text("""
            INSERT INTO pnc_records (id, visit_id, institution_id, pnc_number, year,
                mother_condition, baby_condition, baby_weight_kg, breastfeeding_status,
                follow_up_needed, auditor_id, "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), :vid, :iid, :pnc, :year, :mc, :bc, :bw, :bf,
                :fup, :auditor, NOW(), NOW())
        """), {
            "vid": data["visit_id"], "iid": data["institution_id"], "pnc": pnc_number, "year": 2026,
            "mc": data["mother_condition"], "bc": data["baby_condition"],
            "bw": data.get("baby_weight_kg"), "bf": data.get("breastfeeding_status"),
            "fup": data.get("follow_up_needed", False), "auditor": data["auditor_id"],
        })
        await db.commit()
        return {"message": "PNC record created", "pnc_number": pnc_number}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pnc")
async def list_pnc(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        if institution_id:
            result = await db.execute(
                text("SELECT * FROM pnc_records WHERE institution_id = :iid ORDER BY \"createdAt\" DESC"),
                {"iid": institution_id}
            )
        else:
            result = await db.execute(text("SELECT * FROM pnc_records ORDER BY \"createdAt\" DESC"))
        return [dict(r) for r in result.mappings().all()]
    except Exception:
        return []
