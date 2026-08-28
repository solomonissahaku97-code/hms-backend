"""NHIA XML export and vetting routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.nhia import NHISClaimExportRecord, VettingResult
from app.services import nhia_export_service, claim_vetting_service
from app.services.claim_service import ClaimService
from app.services.hms_client import hms_client

router = APIRouter()


class VetAndPersistRequest(BaseModel):
    persist: bool = False
    institution_id: Optional[str] = None


@router.post("/xml/generate")
async def generate_xml(
    institution_id: UUID,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    statuses: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Generate NHIA XML export for claims."""
    claim_service = ClaimService(db)

    status_list = statuses.split(",") if statuses else []
    claims, total = await claim_service.list_claims(
        start_date=start_date, end_date=end_date,
        limit=1000,
    )

    if status_list:
        claims = [c for c in claims if str(c.claim_status.value) in status_list]

    if not claims:
        raise HTTPException(status_code=404, detail="No claims found for the selected filters")

    institution = await hms_client.get_institution(str(institution_id))
    if not institution:
        institution = {"serial_code": "UNK", "name": "Unknown"}

    try:
        result = await nhia_export_service.generate_xml_report(
            db=db,
            institution_id=str(institution_id),
            claims=claims,
            institution=institution,
            user_id=user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.commit()
    return {
        "batch_number": result["batch_number"],
        "file_name": result["file_name"],
        "total_claims": len(claims),
        "total_amount": sum(float(c.total_amount or 0) for c in claims),
    }


@router.get("/export-history", response_model=list[NHISClaimExportRecord])
async def list_exports(
    institution_id: Optional[UUID] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """List NHIS claim export batches."""
    exports = await nhia_export_service.list_exports(
        db=db, institution_id=str(institution_id) if institution_id else None,
        limit=limit, offset=offset,
    )
    return exports


@router.post("/vetting/upload")
async def vet_claim_xml(
    file: UploadFile = File(...),
    persist: bool = Query(False, description="Save parsed claims to database"),
    institution_id: Optional[str] = Query(None, description="Institution ID for persistence"),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Upload and vet an NHIA XML file.

    Parses the full XML structure including diagnosis, patient info,
    specialties, medicines, and validates against NHIA business rules.

    If persist=true, saves parsed claims to the claims + claim_items tables.
    """
    if not file.filename or not file.filename.endswith(".xml"):
        raise HTTPException(status_code=400, detail="Only XML files are allowed")

    content = await file.read()

    # Check file size (10MB limit)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    try:
        xml_string = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded XML")

    # Parse and validate
    result = claim_vetting_service.vet_claim_xml(
        xml_string=xml_string,
        file_name=file.filename,
    )

    # Optionally persist to database (persist valid claims even if batch has some invalid)
    persisted_count = 0
    if persist and result["claims"]:
        persisted_count = await _persist_claims(
            db=db,
            vetting_result=result,
            institution_id=institution_id,
            user_id=user.id,
        )
        await db.commit()

    return {
        "is_valid": result["is_valid"],
        "format": result.get("format"),
        "file_name": file.filename,
        "file_size": len(content),
        "summary": result.get("summary", {}),
        "claims": result.get("claims", []),
        "errors": result.get("errors", []),
        "persisted": persisted_count,
    }


@router.post("/vetting/validate")
async def validate_claim_xml_content(
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Validate XML content sent as JSON body (for preview without file upload)."""
    xml_string = body.get("xml_content", "")
    if not xml_string:
        raise HTTPException(status_code=400, detail="xml_content is required")

    result = claim_vetting_service.vet_claim_xml(xml_string=xml_string)
    return result


@router.get("/vetting/formats")
async def get_supported_formats(user: AuthUser = Depends(get_current_user)):
    """Get supported XML formats for vetting."""
    return claim_vetting_service.SUPPORTED_FORMATS


@router.get("/vetting/stats")
async def get_vetting_stats(
    institution_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Get claim vetting statistics from the database."""
    try:
        # Total claims
        result = await db.execute(text("SELECT COUNT(*) FROM claims"))
        total_claims = result.scalar() or 0

        # Claims by status
        status_result = await db.execute(text("""
            SELECT claim_status, COUNT(*) as count
            FROM claims
            GROUP BY claim_status
            ORDER BY count DESC
        """))
        status_breakdown = {row[0]: row[1] for row in status_result.all()}

        # Total amounts
        amount_result = await db.execute(text("""
            SELECT
                COALESCE(SUM(total_amount), 0) as total_amount,
                COALESCE(SUM(total_nhia_amount), 0) as total_nhia_amount,
                COALESCE(SUM(total_patient_amount), 0) as total_patient_amount
            FROM claims
        """))
        amounts = amount_result.one()

        # Recent claims
        recent_result = await db.execute(text("""
            SELECT id, claim_reference_number, claim_status, total_amount, created_at
            FROM claims
            ORDER BY created_at DESC
            LIMIT 10
        """))
        recent_claims = [dict(row) for row in recent_result.mappings().all()]

        return {
            "total_claims": total_claims,
            "status_breakdown": status_breakdown,
            "total_amount": float(amounts[0]),
            "total_nhia_amount": float(amounts[1]),
            "total_patient_amount": float(amounts[2]),
            "recent_claims": recent_claims,
        }

    except Exception as e:
        return {
            "total_claims": 0,
            "status_breakdown": {},
            "total_amount": 0,
            "total_nhia_amount": 0,
            "total_patient_amount": 0,
            "recent_claims": [],
            "error": str(e),
        }


async def _find_visit_for_claim(db: AsyncSession, claim_data: dict) -> Optional[str]:
    """Find an existing visit matching this claim's patient, or return None."""
    member_no = claim_data.get("member_no", "")
    surname = claim_data.get("surname", "")
    date_of_service = claim_data.get("date_of_service") or claim_data.get("dates_of_service", [None])[0]

    if not member_no and not surname:
        return None

    try:
        # Try to find a visit by patient phone/folder matching member_no
        if member_no:
            result = await db.execute(text("""
                SELECT v.id FROM visits v
                JOIN patients p ON v.patient_id = p.id
                WHERE (p.phone = :member OR p.folder_number = :member OR p.nhis_number = :member)
                ORDER BY v.created_at DESC LIMIT 1
            """), {"member": member_no})
            row = result.first()
            if row:
                return str(row[0])

        # Fallback: find by patient name
        if surname:
            result = await db.execute(text("""
                SELECT v.id FROM visits v
                JOIN patients p ON v.patient_id = p.id
                WHERE UPPER(p.last_name) = UPPER(:surname)
                ORDER BY v.created_at DESC LIMIT 1
            """), {"surname": surname})
            row = result.first()
            if row:
                return str(row[0])

    except Exception:
        pass

    return None


async def _persist_claims(
    db: AsyncSession,
    vetting_result: dict,
    institution_id: Optional[str],
    user_id: str,
) -> int:
    """Persist vetted claims to the claims + claim_items tables."""
    from app.models.claim import Claim
    from app.models.claim_item import ClaimItem
    from datetime import datetime
    import uuid

    count = 0
    skipped = 0
    for claim_data in vetting_result.get("claims", []):
        # Only persist valid claims
        if not claim_data.get("is_valid", True):
            continue

        # Find a matching visit by patient member number (if available)
        visit_id = await _find_visit_for_claim(db, claim_data)
        if not visit_id:
            skipped += 1
            continue

        sp_name = f"sp_claim_{count}"
        try:
            await db.execute(text(f"SAVEPOINT {sp_name}"))

            timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            seq = count + 1
            ref_number = f"CLM-{timestamp}-{seq:04d}"
            claim_id = str(uuid.uuid4())

            # claims table uses camelCase columns: createdAt, updatedAt
            await db.execute(text("""
                INSERT INTO claims (
                    id, visit_id, claim_status, submission_date,
                    total_amount, total_nhia_amount, total_patient_amount,
                    claim_reference_number, "createdAt", "updatedAt"
                ) VALUES (
                    :id, :visit_id, 'Pending', NOW(),
                    :total_amount, :total_nhia_amount, :total_patient_amount,
                    :ref_number, NOW(), NOW()
                )
            """), {
                "id": claim_id,
                "visit_id": visit_id,
                "total_amount": claim_data.get("total_amount", 0),
                "total_nhia_amount": sum(
                    m.get("db_nhia_price", 0) * m.get("dispensed_qty", 1)
                    for m in claim_data.get("medicines", [])
                ),
                "total_patient_amount": 0,
                "ref_number": ref_number,
            })

            # claim_items table uses snake_case: created_at, updated_at
            for med in claim_data.get("medicines", []):
                item_id = str(uuid.uuid4())
                qty = med.get("dispensed_qty", 1)
                db_price = med.get("db_nhia_price", 0)
                amount = db_price * qty if db_price else 0

                await db.execute(text("""
                    INSERT INTO claim_items (
                        id, claim_id, visit_id, item_type, gdrg_code,
                        description, unit_price, quantity, nhia_amount,
                        amount, co_payment, paid_by_patient,
                        date_performed, created_at, updated_at
                    ) VALUES (
                        :id, :claim_id, :visit_id, 'MEDICATION', :code,
                        :description, :unit_price, :quantity, :nhia_amount,
                        :amount, 0, false,
                        :date_performed, NOW(), NOW()
                    )
                """), {
                    "id": item_id,
                    "claim_id": claim_id,
                    "visit_id": visit_id,
                    "code": med.get("code", ""),
                    "description": med.get("prescription_text") or med.get("db_description") or med.get("code", ""),
                    "unit_price": db_price,
                    "quantity": qty,
                    "nhia_amount": amount,
                    "amount": amount,
                    "date_performed": med.get("service_date") or datetime.utcnow(),
                })

            for proc in claim_data.get("procedures", []):
                item_id = str(uuid.uuid4())
                db_price = proc.get("db_nhia_price", 0)

                await db.execute(text("""
                    INSERT INTO claim_items (
                        id, claim_id, visit_id, item_type, gdrg_code,
                        description, unit_price, quantity, nhia_amount,
                        amount, co_payment, paid_by_patient,
                        date_performed, created_at, updated_at
                    ) VALUES (
                        :id, :claim_id, :visit_id, 'PROCEDURE', :code,
                        :description, :unit_price, 1, :nhia_amount,
                        :amount, 0, false,
                        :date_performed, NOW(), NOW()
                    )
                """), {
                    "id": item_id,
                    "claim_id": claim_id,
                    "visit_id": visit_id,
                    "code": proc.get("gdrg_code", ""),
                    "description": proc.get("description", ""),
                    "unit_price": db_price,
                    "nhia_amount": db_price,
                    "amount": db_price,
                    "date_performed": proc.get("service_date") or datetime.utcnow(),
                })

            await db.execute(text(f"RELEASE SAVEPOINT {sp_name}"))
            count += 1

        except Exception as e:
            try:
                await db.execute(text(f"ROLLBACK TO SAVEPOINT {sp_name}"))
            except Exception:
                pass
            print(f"Warning: Failed to persist claim {claim_data.get('claim_id', '?')}: {e}")
            continue

    print(f"Persisted {count} claims, skipped {skipped} (no matching visit)")
    return count
