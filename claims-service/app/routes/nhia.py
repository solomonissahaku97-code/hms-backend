"""NHIA XML export and vetting routes."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, AuthUser
from app.schemas.nhia import NHISClaimExportRecord, VettingResult
from app.services import nhia_export_service, claim_vetting_service
from app.services.claim_service import ClaimService
from app.services.hms_client import hms_client

router = APIRouter()


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

    # Fetch claims
    status_list = statuses.split(",") if statuses else []
    claims, total = await claim_service.list_claims(
        start_date=start_date, end_date=end_date,
        limit=1000,
    )

    if status_list:
        claims = [c for c in claims if str(c.claim_status.value) in status_list]

    if not claims:
        raise HTTPException(status_code=404, detail="No claims found for the selected filters")

    # Fetch institution info
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


@router.post("/vetting/upload", response_model=VettingResult)
async def vet_claim_xml(
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
):
    """Upload and vet an NHIA XML file."""
    if not file.filename or not file.filename.endswith(".xml"):
        raise HTTPException(status_code=400, detail="Only XML files are allowed")

    content = await file.read()
    xml_string = content.decode("utf-8")

    result = claim_vetting_service.vet_claim_xml(xml_string)
    return result


@router.get("/vetting/formats")
async def get_supported_formats(user: AuthUser = Depends(get_current_user)):
    """Get supported XML formats for vetting."""
    return claim_vetting_service.SUPPORTED_FORMATS
