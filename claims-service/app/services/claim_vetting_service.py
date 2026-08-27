"""Claim vetting service - validates NHIA claim XML files."""

from typing import Any, Dict, List, Optional
import xml.etree.ElementTree as ET


SUPPORTED_FORMATS = {
    "NHISClaims": {
        "root": "NHISClaims",
        "description": "NHIS export format with Claim, Patient, ClaimItems elements",
        "required_fields": ["ClaimReferenceNumber", "Patient/PatientID", "TotalClaimAmount"],
    },
    "ClaimsFormat": {
        "root": "claims",
        "description": "Original NHIA submission format",
        "required_fields": ["claimID", "memberNo", "dateOfService"],
    },
    "Batch": {
        "root": "Batch",
        "description": "Batch format with Batch, Patients, PatientData, Claims elements",
        "required_fields": ["ClaimIdentificationNumber", "PatientData/MemberNumber", "TotalCost"],
    },
}


def detect_format(root: ET.Element) -> Optional[str]:
    """Detect which NHIA XML format is being used."""
    tag = root.tag
    if tag == "NHISClaims":
        return "NHISClaims"
    if tag == "claims":
        return "ClaimsFormat"
    if tag == "Batch":
        return "Batch"
    return None


def parse_nhia_claims(root: ET.Element) -> List[Dict[str, Any]]:
    """Parse NHISClaims format."""
    claims = []
    for claim_el in root.findall("Claim"):
        claim = {
            "reference": claim_el.findtext("ClaimReferenceNumber", ""),
            "total_amount": float(claim_el.findtext("TotalClaimAmount", "0") or 0),
            "status": claim_el.findtext("ClaimStatus", ""),
            "items": [],
        }
        items_el = claim_el.find("ClaimItems")
        if items_el is not None:
            for item_el in items_el.findall("Item"):
                claim["items"].append({
                    "name": item_el.findtext("ItemName", ""),
                    "code": item_el.findtext("ItemCode", ""),
                    "type": item_el.findtext("ItemType", ""),
                    "quantity": int(item_el.findtext("Quantity", "1") or 1),
                    "unit_price": float(item_el.findtext("UnitPrice", "0") or 0),
                    "total_amount": float(item_el.findtext("TotalAmount", "0") or 0),
                    "nhia_amount": float(item_el.findtext("NHIACoveredAmount", "0") or 0),
                    "patient_amount": float(item_el.findtext("PatientAmount", "0") or 0),
                })
        claims.append(claim)
    return claims


def parse_claims_format(root: ET.Element) -> List[Dict[str, Any]]:
    """Parse original NHIA submission format."""
    claims = []
    for claim_el in root.findall("claim"):
        patient = claim_el.find("patient") or claim_el
        claim = {
            "reference": claim_el.findtext("claimID", ""),
            "member_number": patient.findtext("memberNo", patient.findtext("MemberNumber", "")),
            "surname": patient.findtext("surname", patient.findtext("Surname", "")),
            "gender": patient.findtext("gender", patient.findtext("Gender", "")),
            "date_of_service": claim_el.findtext("dateOfService", ""),
            "items": [],
        }
        # Parse medicines
        for med_el in claim_el.findall("medicine"):
            claim["items"].append({
                "code": med_el.findtext("medicineCode", ""),
                "quantity": int(med_el.findtext("dispensedQty", "1") or 1),
            })
        claims.append(claim)
    return claims


def validate_amounts(claims: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Validate claim amounts match sum of items."""
    results = []
    for claim in claims:
        if "items" in claim and claim["items"]:
            calculated = sum(
                (i.get("nhia_amount", 0) or 0) + (i.get("patient_amount", 0) or 0)
                for i in claim["items"]
            )
            declared = claim.get("total_amount", 0)
            diff = abs(calculated - declared)
            results.append({
                "check": f"Claim {claim.get('reference', 'Unknown')} total",
                "is_valid": diff < 0.01,
                "declared": declared,
                "calculated": calculated,
            })
        else:
            results.append({
                "check": f"Claim {claim.get('reference', 'Unknown')}",
                "is_valid": True,
            })
    return results


def vet_claim_xml(xml_string: str) -> Dict[str, Any]:
    """Main entry point for vetting a claim XML."""
    try:
        root = ET.fromstring(xml_string)

        fmt = detect_format(root)
        if not fmt:
            return {
                "is_valid": False,
                "error": "Unrecognized XML format",
                "supported_formats": list(SUPPORTED_FORMATS.keys()),
            }

        if fmt == "NHISClaims":
            claims = parse_nhia_claims(root)
        elif fmt == "ClaimsFormat":
            claims = parse_claims_format(root)
        else:
            claims = []

        if not claims:
            return {"is_valid": False, "error": "No claims found in XML"}

        validation_results = validate_amounts(claims)
        is_valid = all(r["is_valid"] for r in validation_results)

        return {
            "is_valid": is_valid,
            "format": fmt,
            "results": validation_results,
            "claim_data": claims,
            "summary": {
                "total_claims": len(claims),
                "total_items": sum(len(c.get("items", [])) for c in claims),
                "valid_claims": sum(1 for r in validation_results if r["is_valid"]),
            },
        }

    except ET.ParseError as e:
        return {"is_valid": False, "error": f"XML parse error: {str(e)}"}
    except Exception as e:
        return {"is_valid": False, "error": f"Vetting failed: {str(e)}"}
