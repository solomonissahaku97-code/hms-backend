"""NHIA XML export service."""

import os
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim
from app.models.claim_item import ClaimItem
from app.models.nhis_claim_export import NHISClaimExport
from app.utils.helpers import generate_batch_number, format_nhia_date


def build_nhia_xml(claims: list, institution: dict) -> str:
    """Build NHIA-compliant XML from claims data."""
    batch_number = generate_batch_number(institution.get("serial_code", "UNK"))
    timestamp = datetime.utcnow().isoformat()

    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append(f'<NHISClaims version="1.0" generatedAt="{timestamp}">')
    lines.append(f'  <FacilityID>{institution.get("serial_code", "")}</FacilityID>')
    lines.append(f'  <FacilityName>{institution.get("name", "")}</FacilityName>')
    lines.append(f'  <ExportBatch>{batch_number}</ExportBatch>')

    for claim in claims:
        claim_data = claim if isinstance(claim, dict) else {
            "reference": claim.claim_reference_number,
            "total": float(claim.total_amount or 0),
            "status": str(claim.claim_status.value) if hasattr(claim.claim_status, 'value') else str(claim.claim_status),
            "created": format_nhia_date(claim.created_at),
            "items": [],
        }

        lines.append('  <Claim>')
        lines.append(f'    <ClaimReferenceNumber>{claim_data["reference"]}</ClaimReferenceNumber>')
        lines.append(f'    <TotalClaimAmount>{claim_data["total"]:.2f}</TotalClaimAmount>')
        lines.append(f'    <ClaimStatus>{claim_data["status"]}</ClaimStatus>')
        lines.append(f'    <VisitDate>{claim_data["created"]}</VisitDate>')

        # Add claim items if available
        if hasattr(claim, 'items') and claim.items:
            lines.append('    <ClaimItems>')
            for item in claim.items:
                lines.append('      <Item>')
                lines.append(f'        <ItemName>{item.description or ""}</ItemName>')
                lines.append(f'        <ItemCode>{item.gdrg_code or ""}</ItemCode>')
                lines.append(f'        <ItemType>{item.item_type.value if hasattr(item.item_type, "value") else item.item_type}</ItemType>')
                lines.append(f'        <Quantity>{item.quantity or 1}</Quantity>')
                lines.append(f'        <UnitPrice>{float(item.unit_price or 0):.2f}</UnitPrice>')
                lines.append(f'        <TotalAmount>{float(item.amount or 0):.2f}</TotalAmount>')
                lines.append(f'        <NHIACoveredAmount>{float(item.nhia_amount or 0):.2f}</NHIACoveredAmount>')
                lines.append(f'        <PatientAmount>{float(item.co_payment or 0):.2f}</PatientAmount>')
                lines.append('      </Item>')
            lines.append('    </ClaimItems>')

        lines.append('  </Claim>')

    lines.append('</NHISClaims>')
    return '\n'.join(lines)


async def generate_xml_report(
    db: AsyncSession,
    institution_id: str,
    claims: List[Claim],
    institution: dict,
    user_id: Optional[str] = None,
) -> dict:
    """Generate NHIA XML export for claims."""
    if not claims:
        raise ValueError("No claims to export")

    xml_data = build_nhia_xml(claims, institution)

    batch_number = generate_batch_number(institution.get("serial_code", "UNK"))
    file_name = f"{batch_number}.xml"

    # Save to disk
    export_dir = os.environ.get("EXPORT_DIR", "./exports")
    os.makedirs(export_dir, exist_ok=True)
    file_path = os.path.join(export_dir, file_name)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(xml_data)

    # Log export record
    export_record = NHISClaimExport(
        batch_number=batch_number,
        institution_id=institution_id,
        file_name=file_name,
        file_path=file_path,
        total_claims=len(claims),
        total_amount=sum(float(c.total_amount or 0) for c in claims),
        generated_by=user_id,
        export_status="Completed",
    )
    db.add(export_record)
    await db.flush()

    return {
        "batch_number": batch_number,
        "file_name": file_name,
        "xml_data": xml_data,
        "export_record": export_record,
    }


async def list_exports(
    db: AsyncSession,
    institution_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[NHISClaimExport]:
    """List NHIS claim export batches."""
    query = select(NHISClaimExport)
    if institution_id:
        query = query.where(NHISClaimExport.institution_id == institution_id)
    query = query.order_by(NHISClaimExport.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())
