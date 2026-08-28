from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.middleware.auth import authenticate
from datetime import datetime, date
import uuid

router = APIRouter(prefix="/api/v1/maternity", tags=["ANC"])


@router.post("/anc")
async def create_anc(data: dict, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Create ANC record directly (without visit)"""
    try:
        anc_number = f"ANC-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}"
        auditor_raw = user.get("id", "") if isinstance(user, dict) else getattr(user, "id", "")
        try:
            auditor = str(uuid.UUID(str(auditor_raw)))
            staff_check = await db.execute(text('SELECT id FROM staffs WHERE id = :sid LIMIT 1'), {"sid": auditor})
            if not staff_check.first():
                raise ValueError("not found")
        except (ValueError, AttributeError, Exception):
            staff_row = (await db.execute(text('SELECT id FROM staffs LIMIT 1'))).first()
            auditor = str(staff_row[0]) if staff_row else str(uuid.uuid4())

        await db.execute(text("""
            INSERT INTO anc_records (id, visit_id, institution_id, anc_number, year,
                mother_age, parity, gestational_age_weeks, blood_pressure, hemoglobin_level,
                hiv_status, auditor_id, "createdAt", "updatedAt")
            VALUES (:id, :vid, :iid, :anc, :year, :age, :parity, :ga, :bp,
                :hgb, :hiv, :aud, NOW(), NOW())
        """), {
            "id": str(uuid.uuid4()),
            "vid": data.get("visit_id", str(uuid.uuid4())),
            "iid": data["institution_id"],
            "anc": anc_number,
            "year": datetime.now().year,
            "age": data.get("mother_age"),
            "parity": data.get("parity"),
            "ga": data.get("gestational_age_weeks"),
            "bp": data.get("blood_pressure"),
            "hgb": data.get("hemoglobin_level"),
            "hiv": data.get("hiv_status", "Unknown"),
            "aud": auditor,
        })
        await db.commit()
        return {"message": "ANC record created", "anc_number": anc_number}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anc/register")
async def register_anc(data: dict, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """Register ANC patient — creates visit + ANC record + pregnancy timeline

    Expected body:
    {
        "patient_id": "uuid",
        "institution_id": "uuid",
        "lmp": "2026-01-15",           # required for timeline
        "edd": "2026-10-22",           # auto-calculated if not provided
        "mother_age": 28,
        "parity": 2,
        "gestational_age_weeks": 20,
        "blood_pressure": "120/80",
        "hemoglobin_level": 12.5,
        "hiv_status": "Negative"        # Positive | Negative | Unknown
    }
    """
    try:
        patient_id = data.get("patient_id")
        institution_id = data.get("institution_id")

        if not patient_id or not institution_id:
            raise HTTPException(status_code=400, detail="patient_id and institution_id required")

        # 1. Check patient exists
        patient_result = await db.execute(text(
            "SELECT id, first_name, last_name, gender, date_of_birth FROM patients WHERE id = :pid"
        ), {"pid": patient_id})
        patient = patient_result.mappings().first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # 2. Find maternity department
        dept_result = await db.execute(text(
            "SELECT id FROM departments WHERE institution_id = :iid AND name ILIKE '%maternity%' LIMIT 1"
        ), {"iid": institution_id})
        dept_row = dept_result.first()
        dept_id = str(dept_row[0]) if dept_row else None

        # 3. Create Visit
        visit_id = str(uuid.uuid4())
        attendance_num = f"ATT-{datetime.now().year}-{str(uuid.uuid4())[:6].upper()}"
        await db.execute(text("""
            INSERT INTO visits (id, patient_id, institution_id, department_id, visit_type,
                attendance_type, attendance_number, status, created_at, updated_at)
            VALUES (:vid, :pid, :iid, NULLIF(:did, '')::uuid, 'Maternity',
                'New', :att, 'Active', NOW(), NOW())
        """), {"vid": visit_id, "pid": patient_id, "iid": institution_id,
               "did": dept_id or "", "att": attendance_num})

        # 4. Create ANC record
        anc_number = f"ANC-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}"
        anc_id = str(uuid.uuid4())
        auditor_raw = user.get("id", "") if isinstance(user, dict) else getattr(user, "id", "")
        # auditor_id is UUID FK → staffs table. Find valid staff for service-key auth.
        try:
            auditor = str(uuid.UUID(str(auditor_raw)))
            # Verify it exists in staffs
            staff_check = await db.execute(text('SELECT id FROM staffs WHERE id = :sid LIMIT 1'), {"sid": auditor})
            if not staff_check.first():
                raise ValueError("not found")
        except (ValueError, AttributeError, Exception):
            staff_row = (await db.execute(text('SELECT id FROM staffs LIMIT 1'))).first()
            auditor = str(staff_row[0]) if staff_row else str(uuid.uuid4())

        await db.execute(text("""
            INSERT INTO anc_records (id, visit_id, institution_id, anc_number, year,
                mother_age, parity, gestational_age_weeks, blood_pressure, hemoglobin_level,
                hiv_status, auditor_id, "createdAt", "updatedAt")
            VALUES (:id, :vid, :iid, :anc, :year, :age, :parity, :ga, :bp, :hgb, :hiv, :aud, NOW(), NOW())
        """), {
            "id": anc_id, "vid": visit_id, "iid": institution_id, "anc": anc_number,
            "year": datetime.now().year, "age": data.get("mother_age"),
            "parity": data.get("parity"), "ga": data.get("gestational_age_weeks"),
            "bp": data.get("blood_pressure"), "hgb": data.get("hemoglobin_level"),
            "hiv": data.get("hiv_status", "Unknown"), "aud": auditor,
        })

        # 5. Create Pregnancy Timeline (lmp and edd are NOT NULL)
        lmp_str = data.get("lmp")
        edd_str = data.get("edd")
        ga = data.get("gestational_age_weeks") or 0

        # Auto-calculate EDD from LMP if not provided
        if lmp_str and not edd_str:
            from datetime import timedelta
            lmp_date = date.fromisoformat(lmp_str) if isinstance(lmp_str, str) else lmp_str
            edd_date = lmp_date + timedelta(days=280)
            edd_str = edd_date.isoformat()

        # Auto-calculate LMP from EDD if not provided
        if edd_str and not lmp_str:
            from datetime import timedelta
            edd_date = date.fromisoformat(edd_str) if isinstance(edd_str, str) else edd_str
            lmp_date = edd_date - timedelta(days=280)
            lmp_str = lmp_date.isoformat()

        # Auto-calculate GA from LMP if not provided
        if lmp_str and not ga:
            from datetime import timedelta
            lmp_date = date.fromisoformat(lmp_str) if isinstance(lmp_str, str) else lmp_str
            ga = (date.today() - lmp_date).days // 7

        if lmp_str and edd_str:
            from datetime import timedelta
            progress = min((ga / 40) * 100, 100)
            lmp_date = date.fromisoformat(lmp_str) if isinstance(lmp_str, str) else lmp_str
            edd_date = date.fromisoformat(edd_str) if isinstance(edd_str, str) else edd_str
            await db.execute(text("""
                INSERT INTO pregnancy_timelines (id, visit_id, pregnancy_id, lmp, edd,
                    current_week, total_weeks, progress_percent, weeks,
                    "createdAt", "updatedAt")
                VALUES (:id, :vid, :pid, :lmp, :edd, :cw, 40, :pp, '[]'::jsonb, NOW(), NOW())
            """), {
                "id": str(uuid.uuid4()),
                "vid": patient_id,  # FK references patients.id
                "pid": anc_id,      # FK references anc_records.id
                "lmp": lmp_date, "edd": edd_date,
                "cw": ga, "pp": progress
            })

        await db.commit()
        return {
            "message": "ANC registered successfully",
            "visit_id": visit_id,
            "anc_number": anc_number,
            "anc_id": anc_id,
            "patient_name": f"{patient['first_name']} {patient['last_name']}"
        }
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anc")
async def list_anc(institution_id: str = None, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    """List ANC records with patient data via JOIN"""
    try:
        base_query = """
            SELECT a.id, a.visit_id, a.institution_id, a.anc_number, a.year,
                a.mother_age, a.parity, a.gestational_age_weeks, a.blood_pressure,
                a.hemoglobin_level, a.hiv_status, a.auditor_id,
                a."createdAt", a."updatedAt",
                p.first_name, p.last_name, p.folder_number, p.phone, p.gender, p.date_of_birth,
                v.status as visit_status, v.attendance_type
            FROM anc_records a
            LEFT JOIN visits v ON a.visit_id = v.id
            LEFT JOIN patients p ON v.patient_id = p.id
        """
        if institution_id:
            result = await db.execute(text(
                f"{base_query} WHERE a.institution_id = :iid ORDER BY a.\"createdAt\" DESC"
            ), {"iid": institution_id})
        else:
            result = await db.execute(text(f"{base_query} ORDER BY a.\"createdAt\" DESC"))
        rows = result.mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        # Fallback: try without JOIN
        try:
            if institution_id:
                result = await db.execute(text(
                    "SELECT * FROM anc_records WHERE institution_id = :iid ORDER BY \"createdAt\" DESC"
                ), {"iid": institution_id})
            else:
                result = await db.execute(text('SELECT * FROM anc_records ORDER BY "createdAt" DESC'))
            return [dict(r) for r in result.mappings().all()]
        except Exception:
            return []


@router.get("/anc/{anc_id}")
async def get_anc(anc_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        result = await db.execute(text("""
            SELECT a.*, p.first_name, p.last_name, p.folder_number, p.gender, p.date_of_birth
            FROM anc_records a
            LEFT JOIN visits v ON a.visit_id = v.id
            LEFT JOIN patients p ON v.patient_id = p.id
            WHERE a.id = :id
        """), {"id": anc_id})
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="ANC record not found")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anc/visit/{visit_id}")
async def get_anc_by_visit(visit_id: str, db: AsyncSession = Depends(get_db), user=Depends(authenticate)):
    try:
        result = await db.execute(text("""
            SELECT a.*, p.first_name, p.last_name, p.folder_number
            FROM anc_records a
            LEFT JOIN visits v ON a.visit_id = v.id
            LEFT JOIN patients p ON v.patient_id = p.id
            WHERE a.visit_id = :vid ORDER BY a."createdAt" ASC
        """), {"vid": visit_id})
        return [dict(r) for r in result.mappings().all()]
    except Exception:
        return []
