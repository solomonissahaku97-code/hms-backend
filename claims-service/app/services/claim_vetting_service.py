"""Claim vetting service - validates and parses NHIA claim XML files.

Handles the Ghana NHIA claims XML format:
<claims>
  <claim>
    <claimID>...</claimID>
    <claimCheckCode>...</claimCheckCode>
    <physicianID>...</physicianID>
    <memberNo>...</memberNo>
    <surname>...</surname>
    <otherNames>...</otherNames>
    <dateOfBirth>...</dateOfBirth>
    <gender>M/F</gender>
    <typeOfService>OPD/IPD</typeOfService>
    <typeOfAttendance>EAE/...</typeOfAttendance>
    <serviceOutcome>DISC/ADMT</serviceOutcome>
    <specialtyAttended>PAED/SURG/...</specialtyAttended>
    <diagnosis>
      <gdrgCode>...</gdrgCode>
      <icd10>...</icd10>
      <diagnosis>Description</diagnosis>
    </diagnosis>
    <medicine>
      <medicineCode>...</medicineCode>
      <dispensedQty>N</dispensedQty>
      <serviceDate>YYYY-MM-DD</serviceDate>
      <prescription><unparsed>...</unparsed></prescription>
    </medicine>
  </claim>
</claims>
"""

from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field, asdict
import xml.etree.ElementTree as ET
from datetime import datetime, date


# ── Data Classes ─────────────────────────────────────────────────

@dataclass
class DiagnosisInfo:
    gdrg_code: str = ""
    icd10_code: str = ""
    description: str = ""

@dataclass
class MedicineInfo:
    code: str = ""
    dispensed_qty: int = 0
    service_date: str = ""
    prescription_text: str = ""
    dose: str = ""
    frequency: str = ""
    duration: str = ""
    # Populated during DB mapping
    db_description: str = ""
    db_nhia_price: float = 0.0
    mapped: bool = False

@dataclass
class ProcedureInfo:
    gdrg_code: str = ""
    description: str = ""
    service_date: str = ""
    # Populated during DB mapping
    db_description: str = ""
    db_nhia_price: float = 0.0
    mapped: bool = False

@dataclass
class ClaimVettingResult:
    claim_id: str = ""
    claim_check_code: str = ""
    physician_id: str = ""
    pre_authorization_codes: str = ""
    member_no: str = ""
    card_serial_no: str = ""
    surname: str = ""
    other_names: str = ""
    date_of_birth: str = ""
    gender: str = ""
    hospital_rec_no: str = ""
    is_dependant: bool = False
    type_of_service: str = ""
    is_unbundled: bool = False
    includes_pharmacy: bool = False
    type_of_attendance: str = ""
    service_outcome: str = ""
    date_of_service: str = ""
    dates_of_service: List[str] = field(default_factory=list)
    specialties: List[str] = field(default_factory=list)
    diagnosis: Optional[DiagnosisInfo] = None
    medicines: List[MedicineInfo] = field(default_factory=list)
    procedures: List[ProcedureInfo] = field(default_factory=list)
    # Validation
    is_valid: bool = True
    validation_issues: List[str] = field(default_factory=list)
    validation_warnings: List[str] = field(default_factory=list)
    # Totals (calculated)
    total_items: int = 0
    total_amount: float = 0.0


@dataclass
class VettingReport:
    is_valid: bool = True
    format: str = ""
    file_name: str = ""
    total_claims: int = 0
    valid_claims: int = 0
    invalid_claims: int = 0
    warning_claims: int = 0
    claims: List[ClaimVettingResult] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)


# ── Supported Formats ────────────────────────────────────────────

SUPPORTED_FORMATS = {
    "claims": {
        "root": "claims",
        "description": "Ghana NHIA claims XML format (claims > claim > fields)",
        "required_fields": ["claimID", "memberNo", "diagnosis"],
    },
    "NHISClaims": {
        "root": "NHISClaims",
        "description": "NHIS export format with Claim, Patient, ClaimItems elements",
        "required_fields": ["ClaimReferenceNumber", "TotalClaimAmount"],
    },
    "Batch": {
        "root": "Batch",
        "description": "Batch format with Batch, Patients, PatientData, Claims elements",
        "required_fields": ["ClaimIdentificationNumber", "PatientData/MemberNumber"],
    },
}


# ── Format Detection ─────────────────────────────────────────────

def detect_format(root: ET.Element) -> Optional[str]:
    """Detect which NHIA XML format is being used."""
    tag = root.tag.lower()
    if tag == "claims":
        return "claims"
    if tag == "nhisclaims":
        return "NHISClaims"
    if tag == "batch":
        return "Batch"
    return None


# ── NHIA Claims Parser (primary format) ──────────────────────────

def _text(el: Optional[ET.Element], default: str = "") -> str:
    """Safely extract text from an XML element."""
    if el is None:
        return default
    return (el.text or "").strip()


def _text_list(parent: ET.Element, tag: str) -> List[str]:
    """Extract all text values for a repeated tag."""
    return [_text(el) for el in parent.findall(tag) if _text(el)]


def parse_claim(el: ET.Element) -> ClaimVettingResult:
    """Parse a single <claim> element from the NHIA claims XML."""
    result = ClaimVettingResult()

    # ── Claim identifiers ────────────────────────────────────────
    result.claim_id = _text(el.find("claimID"))
    result.claim_check_code = _text(el.find("claimCheckCode"))
    result.physician_id = _text(el.find("physicianID"))
    result.pre_authorization_codes = _text(el.find("preAuthorizationCodes"))
    result.hospital_rec_no = _text(el.find("hospitalRecNo"))

    # ── Patient information ──────────────────────────────────────
    result.member_no = _text(el.find("memberNo"))
    result.card_serial_no = _text(el.find("cardSerialNo"))
    result.surname = _text(el.find("surname"))
    result.other_names = _text(el.find("otherNames"))
    result.date_of_birth = _text(el.find("dateOfBirth"))
    result.gender = _text(el.find("gender"))
    result.is_dependant = _text(el.find("isDependant")) == "1"

    # ── Service information ──────────────────────────────────────
    result.type_of_service = _text(el.find("typeOfService")).upper()  # OPD / IPD
    result.is_unbundled = _text(el.find("isUnbundled")) == "1"
    result.includes_pharmacy = _text(el.find("includesPharmacy")) == "1"
    result.type_of_attendance = _text(el.find("typeOfAttendance")).upper()
    result.service_outcome = _text(el.find("serviceOutcome")).upper()  # DISC / ADMT

    # Dates of service (can be multiple <dateOfService> elements)
    result.dates_of_service = _text_list(el, "dateOfService")
    result.date_of_service = result.dates_of_service[0] if result.dates_of_service else ""

    # Specialties (can be multiple <specialtyAttended> elements)
    result.specialties = _text_list(el, "specialtyAttended")

    # ── Diagnosis ────────────────────────────────────────────────
    diag_el = el.find("diagnosis")
    if diag_el is not None:
        result.diagnosis = DiagnosisInfo(
            gdrg_code=_text(diag_el.find("gdrgCode")),
            icd10_code=_text(diag_el.find("icd10")),
            description=_text(diag_el.find("diagnosis")),
        )

    # ── Medicines ────────────────────────────────────────────────
    for med_el in el.findall("medicine"):
        presc_el = med_el.find("prescription")
        med = MedicineInfo(
            code=_text(med_el.find("medicineCode")),
            dispensed_qty=int(_text(med_el.find("dispensedQty"), "0") or "0"),
            service_date=_text(med_el.find("serviceDate")),
        )
        if presc_el is not None:
            med.dose = _text(presc_el.find("dose"))
            med.frequency = _text(presc_el.find("frequency"))
            med.duration = _text(presc_el.find("duration"))
            med.prescription_text = _text(presc_el.find("unparsed"))
        result.medicines.append(med)

    # ── Procedures (if present) ──────────────────────────────────
    for proc_el in el.findall("procedure"):
        result.procedures.append(ProcedureInfo(
            gdrg_code=_text(proc_el.find("gdrgCode") or proc_el.find("code")),
            description=_text(proc_el.find("diagnosis") or proc_el.find("description")),
            service_date=_text(proc_el.find("serviceDate")),
        ))

    # ── Calculate totals ─────────────────────────────────────────
    result.total_items = len(result.medicines) + len(result.procedures)

    return result


def parse_nhia_claims(root: ET.Element) -> List[ClaimVettingResult]:
    """Parse all <claim> elements from the NHIA claims XML."""
    claims = []
    for claim_el in root.findall("claim"):
        claims.append(parse_claim(claim_el))
    return claims


# ── NHISClaims Format Parser (secondary format) ──────────────────

def parse_nhis_claims(root: ET.Element) -> List[ClaimVettingResult]:
    """Parse NHISClaims format (used by our own XML export)."""
    claims = []
    for claim_el in root.findall("Claim"):
        result = ClaimVettingResult()
        result.claim_id = _text(claim_el.find("ClaimReferenceNumber"))
        result.total_amount = float(_text(claim_el.find("TotalClaimAmount"), "0") or "0")

        patient_el = claim_el.find("Patient")
        if patient_el is not None:
            result.member_no = _text(patient_el.find("PatientID"))
            full_name = _text(patient_el.find("FullName"))
            if full_name:
                parts = full_name.split(" ", 1)
                result.surname = parts[0]
                result.other_names = parts[1] if len(parts) > 1 else ""
            result.gender = _text(patient_el.find("Gender"))

        diag_el = claim_el.find("Diagnosis")
        if diag_el is None:
            diag_el = claim_el.find("diagnosis")
        if diag_el is not None:
            result.diagnosis = DiagnosisInfo(
                gdrg_code=_text(diag_el.find("Code") or diag_el.find("gdrgCode")),
                icd10_code=_text(diag_el.find("ICD10") or diag_el.find("icd10")),
                description=_text(diag_el.find("Description") or diag_el.find("diagnosis")),
            )

        items_el = claim_el.find("ClaimItems")
        if items_el is not None:
            for item_el in items_el.findall("Item"):
                result.medicines.append(MedicineInfo(
                    code=_text(item_el.find("ItemCode")),
                    dispensed_qty=int(_text(item_el.find("Quantity"), "1") or "1"),
                    db_description=_text(item_el.find("ItemName")),
                    db_nhia_price=float(_text(item_el.find("NHIACoveredAmount"), "0") or "0"),
                    mapped=True,
                ))

        result.total_items = len(result.medicines) + len(result.procedures)
        claims.append(result)
    return claims


# ── Validation ───────────────────────────────────────────────────

def _validate_claim(claim: ClaimVettingResult) -> ClaimVettingResult:
    """Validate a parsed claim against NHIA business rules."""
    issues = []
    warnings = []

    # ── Required fields ──────────────────────────────────────────
    if not claim.claim_id:
        issues.append("Missing claim ID")
    if not claim.member_no:
        issues.append("Missing NHIS member number")
    if not claim.surname:
        issues.append("Missing patient surname")
    if not claim.gender:
        issues.append("Missing patient gender")
    elif claim.gender not in ("M", "F", "Male", "Female"):
        warnings.append(f"Non-standard gender value: {claim.gender}")

    # ── Diagnosis ────────────────────────────────────────────────
    if not claim.diagnosis:
        issues.append("Missing diagnosis")
    else:
        if not claim.diagnosis.icd10_code:
            issues.append("Missing ICD-10 diagnosis code")
        if not claim.diagnosis.gdrg_code:
            warnings.append("Missing GDRG code")
        if not claim.diagnosis.description:
            warnings.append("Missing diagnosis description")

    # ── Service type ─────────────────────────────────────────────
    if claim.type_of_service and claim.type_of_service not in ("OPD", "IPD"):
        warnings.append(f"Non-standard service type: {claim.type_of_service}")

    # ── Service outcome ──────────────────────────────────────────
    if claim.service_outcome and claim.service_outcome not in ("DISC", "ADMT"):
        warnings.append(f"Non-standard service outcome: {claim.service_outcome}")

    # ── Date validation ──────────────────────────────────────────
    if not claim.date_of_service:
        warnings.append("Missing date of service")
    else:
        try:
            svc_date = datetime.strptime(claim.date_of_service, "%Y-%m-%d").date()
            if svc_date > date.today():
                issues.append("Date of service is in the future")
            age_days = (date.today() - svc_date).days
            if age_days > 90:
                warnings.append(f"Claim is {age_days} days old (may exceed filing deadline)")
        except ValueError:
            warnings.append(f"Invalid date of service format: {claim.date_of_service}")

    # ── Date of birth ────────────────────────────────────────────
    if claim.date_of_birth:
        try:
            dob = datetime.strptime(claim.date_of_birth, "%Y-%m-%d").date()
            if dob > date.today():
                issues.append("Date of birth is in the future")
        except ValueError:
            warnings.append(f"Invalid date of birth format: {claim.date_of_birth}")

    # ── Medicines ────────────────────────────────────────────────
    if not claim.medicines and not claim.procedures:
        warnings.append("No medicines or procedures found in claim")

    for med in claim.medicines:
        if not med.code:
            issues.append(f"Medicine missing code (qty={med.dispensed_qty})")
        if med.dispensed_qty <= 0:
            issues.append(f"Medicine {med.code} has invalid quantity: {med.dispensed_qty}")
        if med.dispensed_qty > 100:
            warnings.append(f"Medicine {med.code} has unusually high quantity: {med.dispensed_qty}")

    # ── Specialty ────────────────────────────────────────────────
    if not claim.specialties:
        warnings.append("No specialty attended specified")

    # ── Assign validity ──────────────────────────────────────────
    claim.validation_issues = issues
    claim.validation_warnings = warnings
    claim.is_valid = len(issues) == 0

    return claim


# ── Summary Builder ──────────────────────────────────────────────

def _build_summary(claims: List[ClaimVettingResult]) -> Dict[str, Any]:
    """Build summary statistics from vetted claims."""
    total_medicines = sum(len(c.medicines) for c in claims)
    total_procedures = sum(len(c.procedures) for c in claims)
    service_types = {}
    specialties = {}
    diagnoses = {}
    outcomes = {}

    for c in claims:
        st = c.type_of_service or "Unknown"
        service_types[st] = service_types.get(st, 0) + 1

        for sp in c.specialties:
            specialties[sp] = specialties.get(sp, 0) + 1

        if c.diagnosis and c.diagnosis.description:
            d = c.diagnosis.description
            diagnoses[d] = diagnoses.get(d, 0) + 1

        if c.service_outcome:
            outcomes[c.service_outcome] = outcomes.get(c.service_outcome, 0) + 1

    return {
        "total_claims": len(claims),
        "valid_claims": sum(1 for c in claims if c.is_valid),
        "invalid_claims": sum(1 for c in claims if not c.is_valid),
        "warning_claims": sum(1 for c in claims if c.validation_warnings and c.is_valid),
        "total_medicines": total_medicines,
        "total_procedures": total_procedures,
        "service_type_breakdown": service_types,
        "specialty_breakdown": dict(sorted(specialties.items(), key=lambda x: -x[1])),
        "top_diagnoses": dict(sorted(diagnoses.items(), key=lambda x: -x[1])[:10]),
        "outcome_breakdown": outcomes,
        "total_issues": sum(len(c.validation_issues) for c in claims),
        "total_warnings": sum(len(c.validation_warnings) for c in claims),
    }


# ── Main Entry Point ─────────────────────────────────────────────

def vet_claim_xml(
    xml_string: str,
    file_name: str = "",
) -> Dict[str, Any]:
    """Parse and validate an NHIA claim XML file.

    Returns a complete vetting report with parsed claims,
    validation results, and summary statistics.
    """
    try:
        root = ET.fromstring(xml_string)
    except ET.ParseError as e:
        return {
            "is_valid": False,
            "error": f"XML parse error: {str(e)}",
            "format": None,
            "claims": [],
            "summary": {},
        }

    fmt = detect_format(root)
    if not fmt:
        return {
            "is_valid": False,
            "error": f"Unrecognized XML root element: <{root.tag}>. Expected one of: {list(SUPPORTED_FORMATS.keys())}",
            "format": None,
            "claims": [],
            "summary": {},
            "supported_formats": list(SUPPORTED_FORMATS.keys()),
        }

    # Parse based on format
    if fmt == "claims":
        claims = parse_nhia_claims(root)
    elif fmt == "NHISClaims":
        claims = parse_nhis_claims(root)
    else:
        return {
            "is_valid": False,
            "error": f"Format '{fmt}' parsing not yet implemented",
            "format": fmt,
            "claims": [],
            "summary": {},
        }

    if not claims:
        return {
            "is_valid": False,
            "error": "No claims found in XML",
            "format": fmt,
            "claims": [],
            "summary": {},
        }

    # Validate each claim
    validated_claims = [_validate_claim(c) for c in claims]

    # Build summary
    summary = _build_summary(validated_claims)
    summary["format"] = fmt

    overall_valid = all(c.is_valid for c in validated_claims)

    return {
        "is_valid": overall_valid,
        "format": fmt,
        "file_name": file_name,
        "claims": [asdict(c) for c in validated_claims],
        "summary": summary,
        "errors": [],
    }
