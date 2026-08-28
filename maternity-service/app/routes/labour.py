from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.middleware.auth import authenticate
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/v1/maternity", tags=["Labour"])


async def _find_labour_department(db: AsyncSession, institution_id: str):
    """Find Labour Ward department by type or name"""
    result = await db.execute(text("""
        SELECT id, name FROM departments
        WHERE institution_id = :iid
          AND (
            "departmentType" = 'Labour Ward'
            OR name ILIKE '%Labour%'
            OR name ILIKE '%Labor%'
          )
        LIMIT 1
    """), {"iid": institution_id})
    return result.mappings().first()


@router.post("/labour/admit")
async def admit_to_labour(data: dict, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Admit a patient from ANC to Labour Ward.

    Expected body:
    {
        "visit_id": "uuid",
        "patient_id": "uuid",
        "institution_id": "uuid",
        "admission_notes": "optional notes",
        "estimated_delivery_date": "2026-01-15" (optional)
    }
    """
    visit_id = data.get("visit_id")
    patient_id = data.get("patient_id")
    institution_id = data.get("institution_id")

    if not visit_id or not patient_id or not institution_id:
        raise HTTPException(status_code=400, detail="visit_id, patient_id and institution_id are required")

    try:
        # 1. Find Labour Ward department
        labour_dept = await _find_labour_department(db, institution_id)
        if not labour_dept:
            raise HTTPException(status_code=400, detail="Labour Ward department not found. Please create it first.")

        dept_id = str(labour_dept["id"])

        # 2. Verify visit exists
        visit_check = await db.execute(
            text("SELECT id FROM visits WHERE id = :vid"), {"vid": visit_id}
        )
        if not visit_check.first():
            raise HTTPException(status_code=404, detail="Visit not found")

        # 3. Update visit department to Labour Ward
        await db.execute(
            text("UPDATE visits SET department_id = :did, updated_at = NOW() WHERE id = :vid"),
            {"did": dept_id, "vid": visit_id}
        )

        # 4. Update patient department
        await db.execute(
            text("UPDATE patients SET department_id = :did, updated_at = NOW() WHERE id = :pid"),
            {"did": dept_id, "pid": patient_id}
        )

        # 5. Create initial partograph with labour start time
        partograph_id = str(uuid.uuid4())
        admission_notes = data.get("admission_notes") or "Admitted to Labour Ward"
        await db.execute(text("""
            INSERT INTO partographs (id, visit_id, labour_start_time, remarks, "createdAt", "updatedAt")
            VALUES (:id, :vid, NOW(), :notes, NOW(), NOW())
        """), {"id": partograph_id, "vid": visit_id, "notes": admission_notes})

        # 6. Update ANC status to 'In Labour'
        await db.execute(text("""
            UPDATE anc_records
            SET status = 'In Labour', "updatedAt" = NOW()
            WHERE visit_id = :vid AND status = 'Active'
        """), {"vid": visit_id})

        await db.commit()

        return {
            "message": "Patient admitted to Labour Ward successfully",
            "visit_id": visit_id,
            "department_id": dept_id,
            "department_name": labour_dept["name"],
            "partograph_id": partograph_id
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/labour/active")
async def get_active_labours(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Get all patients currently in active labour"""
    if not institution_id:
        # Try to extract from user context (service-key auth has no institution)
        if isinstance(user, dict):
            institution_id = user.get("institution_id")
        if not institution_id:
            raise HTTPException(status_code=400, detail="institution_id is required")

    try:
        # 1. Find Labour Ward department
        labour_dept = await _find_labour_department(db, institution_id)
        if not labour_dept:
            return []

        dept_id = str(labour_dept["id"])

        # 2. Get active visits in Labour Ward
        result = await db.execute(text("""
            SELECT
                v.id as visit_id,
                v.patient_id,
                v.institution_id,
                v.status as visit_status,
                v.created_at as admitted_at,
                p.first_name,
                p.last_name,
                p.phone,
                p.folder_number,
                p.gender,
                p.date_of_birth,
                a.anc_number,
                a.gestational_age_weeks,
                a.blood_pressure,
                a.mother_age,
                a.parity,
                a.status as anc_status,
                (
                    SELECT json_build_object(
                        'id', pt.id,
                        'record_time', pt.record_time,
                        'cervical_dilatation', pt.cervical_dilatation,
                        'fetal_heart_rate', pt.fetal_heart_rate,
                        'contractions_frequency', pt.contractions_frequency,
                        'alert', pt.alert
                    )
                    FROM partographs pt
                    WHERE pt.visit_id = v.id
                    ORDER BY pt.record_time DESC
                    LIMIT 1
                ) as latest_partograph,
                (
                    SELECT pt.record_time
                    FROM partographs pt
                    WHERE pt.visit_id = v.id
                    ORDER BY pt.record_time DESC
                    LIMIT 1
                ) as last_observation_time
            FROM visits v
            INNER JOIN patients p ON v.patient_id = p.id
            LEFT JOIN anc_records a ON a.visit_id = v.id
            WHERE v.institution_id = :iid
              AND v.department_id = :did
              AND v.status = 'Active'
            ORDER BY v.created_at ASC
        """), {"iid": institution_id, "did": dept_id})

        rows = result.mappings().all()
        return [dict(r) for r in rows]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/labour/stats")
async def get_labour_stats(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Get labour ward statistics"""
    if not institution_id:
        raise HTTPException(status_code=400, detail="institution_id is required")

    try:
        labour_dept = await _find_labour_department(db, institution_id)
        if not labour_dept:
            return {
                "active_patients": 0,
                "deliveries_today": 0,
                "deliveries_this_month": 0,
                "average_cervical_dilatation": 0
            }

        dept_id = str(labour_dept["id"])

        # Active patients in labour
        active_result = await db.execute(text("""
            SELECT COUNT(*) FROM visits
            WHERE institution_id = :iid AND department_id = :did AND status = 'Active'
        """), {"iid": institution_id, "did": dept_id})
        active_patients = active_result.scalar() or 0

        # Deliveries today
        today = datetime.utcnow().date()
        deliveries_today_result = await db.execute(text("""
            SELECT COUNT(*) FROM delivery_register
            WHERE institution_id = :iid AND date_of_delivery::date = :today
        """), {"iid": institution_id, "today": str(today)})
        deliveries_today = deliveries_today_result.scalar() or 0

        # Deliveries this month
        month_start = today.replace(day=1)
        deliveries_month_result = await db.execute(text("""
            SELECT COUNT(*) FROM delivery_register
            WHERE institution_id = :iid AND date_of_delivery >= :start
        """), {"iid": institution_id, "start": str(month_start)})
        deliveries_this_month = deliveries_month_result.scalar() or 0

        # Average cervical dilatation for active patients
        avg_cd_result = await db.execute(text("""
            SELECT AVG(pt.cervical_dilatation)
            FROM partographs pt
            INNER JOIN visits v ON pt.visit_id = v.id
            WHERE v.institution_id = :iid AND v.department_id = :did AND v.status = 'Active'
              AND pt.cervical_dilatation IS NOT NULL
              AND pt.id = (
                  SELECT pt2.id FROM partographs pt2
                  WHERE pt2.visit_id = v.id
                  ORDER BY pt2.record_time DESC LIMIT 1
              )
        """), {"iid": institution_id, "did": dept_id})
        avg_cd = avg_cd_result.scalar() or 0

        return {
            "active_patients": active_patients,
            "deliveries_today": deliveries_today,
            "deliveries_this_month": deliveries_this_month,
            "average_cervical_dilatation": round(float(avg_cd), 1) if avg_cd else 0
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pnc/{visit_id}")
async def get_pnc_by_visit(visit_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Get PNC record by visit ID"""
    try:
        result = await db.execute(
            text("SELECT * FROM pnc_records WHERE visit_id = :vid ORDER BY \"createdAt\" DESC LIMIT 1"),
            {"vid": visit_id}
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="PNC record not found")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pregnancy-timeline/{visit_id}")
async def get_pregnancy_timeline(visit_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Get pregnancy timeline by visit/patient ID"""
    try:
        result = await db.execute(text("""
            SELECT * FROM pregnancy_timelines
            WHERE visit_id = :vid
            ORDER BY "createdAt" DESC LIMIT 1
        """), {"vid": visit_id})
        row = result.mappings().first()
        if not row:
            return None
        return dict(row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/high-risk")
async def get_high_risk_patients(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Get high-risk ANC patients"""
    if not institution_id:
        raise HTTPException(status_code=400, detail="institution_id is required")

    try:
        result = await db.execute(text("""
            SELECT
                a.id, a.anc_number, a.mother_age, a.parity,
                a.gestational_age_weeks, a.blood_pressure,
                a.hemoglobin_level, a.hiv_status, a.risk_level, a.status,
                p.first_name, p.last_name, p.phone, p.folder_number, p.date_of_birth,
                v.id as visit_id, v.status as visit_status
            FROM anc_records a
            LEFT JOIN visits v ON a.visit_id = v.id
            LEFT JOIN patients p ON v.patient_id = p.id
            WHERE a.institution_id = :iid
              AND a.risk_level IN ('High', 'Very High')
              AND v.status = 'Active'
            ORDER BY
                CASE a.risk_level
                    WHEN 'Very High' THEN 1
                    WHEN 'High' THEN 2
                    ELSE 3
                END,
                a."createdAt" DESC
        """), {"iid": institution_id})
        return [dict(r) for r in result.mappings().all()]

    except Exception as e:
        return []


@router.get("/reports")
async def get_maternity_reports(institution_id: str = None, period: str = "month", db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Get maternity reports — delivery stats, ANC coverage, complications"""
    if not institution_id:
        raise HTTPException(status_code=400, detail="institution_id is required")

    try:
        today = datetime.utcnow()

        if period == "week":
            start_date = today - __import__("datetime").timedelta(days=7)
        elif period == "year":
            start_date = today.replace(month=1, day=1)
        else:  # month
            start_date = today.replace(day=1)

        # Delivery statistics
        delivery_result = await db.execute(text("""
            SELECT
                COUNT(*) as total_deliveries,
                COUNT(*) FILTER (WHERE mode_of_delivery = 'SVD') as svd_count,
                COUNT(*) FILTER (WHERE mode_of_delivery = 'Caesarean') as c_section_count,
                COUNT(*) FILTER (WHERE mode_of_delivery = 'Assisted') as assisted_count,
                COUNT(*) FILTER (WHERE baby_sex = 'Male') as male_count,
                COUNT(*) FILTER (WHERE baby_sex = 'Female') as female_count,
                COUNT(*) FILTER (WHERE outcome = 'Alive') as alive_count,
                COUNT(*) FILTER (WHERE outcome = 'Stillbirth') as stillbirth_count,
                COUNT(*) FILTER (WHERE complications IS NOT NULL) as complicated_count,
                AVG(birth_weight) as avg_birth_weight
            FROM delivery_register
            WHERE institution_id = :iid AND date_of_delivery >= :start
        """), {"iid": institution_id, "start": start_date})
        delivery_stats = dict(delivery_result.mappings().first() or {})

        # ANC coverage
        anc_result = await db.execute(text("""
            SELECT
                COUNT(*) as total_anc,
                COUNT(*) FILTER (WHERE risk_level = 'High') as high_risk,
                COUNT(*) FILTER (WHERE risk_level = 'Very High') as very_high_risk,
                AVG(gestational_age_weeks) as avg_ga,
                COUNT(*) FILTER (WHERE hiv_status = 'Positive') as hiv_positive
            FROM anc_records
            WHERE institution_id = :iid AND "createdAt" >= :start
        """), {"iid": institution_id, "start": start_date})
        anc_stats = dict(anc_result.mappings().first() or {})

        # Mode of delivery breakdown
        mod_result = await db.execute(text("""
            SELECT mode_of_delivery, COUNT(*) as count
            FROM delivery_register
            WHERE institution_id = :iid AND date_of_delivery >= :start
            GROUP BY mode_of_delivery
            ORDER BY count DESC
        """), {"iid": institution_id, "start": start_date})
        mode_breakdown = [dict(r) for r in mod_result.mappings().all()]

        # Complications breakdown
        comp_result = await db.execute(text("""
            SELECT complications, COUNT(*) as count
            FROM delivery_register
            WHERE institution_id = :iid AND date_of_delivery >= :start AND complications IS NOT NULL
            GROUP BY complications
            ORDER BY count DESC
        """), {"iid": institution_id, "start": start_date})
        complications_breakdown = [dict(r) for r in comp_result.mappings().all()]

        return {
            "period": period,
            "start_date": str(start_date.date()),
            "delivery_statistics": delivery_stats,
            "anc_coverage": anc_stats,
            "mode_of_delivery_breakdown": mode_breakdown,
            "complications_breakdown": complications_breakdown
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
