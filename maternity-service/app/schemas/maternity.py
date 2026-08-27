from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, date

# ── ANC ──────────────────────────────────────────────────────────
class ANCCreate(BaseModel):
    visit_id: UUID
    institution_id: UUID
    auditor_id: UUID
    gestational_age_weeks: Optional[int] = None
    mother_age: Optional[int] = None
    parity: Optional[int] = None
    blood_pressure: Optional[str] = None
    hemoglobin_level: Optional[float] = None
    hiv_status: Optional[str] = None
    risk_level: Optional[str] = "Low"
    lmp: Optional[date] = None
    edd: Optional[date] = None

class ANCRegister(BaseModel):
    patient_id: UUID
    institution_id: UUID
    department_id: UUID
    auditor_id: UUID
    gestational_age_weeks: Optional[int] = None
    mother_age: Optional[int] = None
    parity: Optional[int] = None
    blood_pressure: Optional[str] = None
    hemoglobin_level: Optional[float] = None
    hiv_status: Optional[str] = None
    lmp: Optional[date] = None
    edd: Optional[date] = None

class ANCResponse(BaseModel):
    id: UUID
    visit_id: UUID
    anc_number: Optional[str] = None
    mother_age: Optional[int] = None
    parity: Optional[int] = None
    gestational_age_weeks: Optional[int] = None
    blood_pressure: Optional[str] = None
    hiv_status: Optional[str] = None
    risk_level: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

# ── Partograph ───────────────────────────────────────────────────
class PartographCreate(BaseModel):
    visit_id: UUID
    cervical_dilatation: Optional[float] = None
    fetal_heart_rate: Optional[int] = None
    contractions: Optional[int] = None
    maternal_pulse: Optional[int] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    temperature: Optional[float] = None
    remark: Optional[str] = None

class PartographResponse(BaseModel):
    id: UUID
    visit_id: UUID
    record_time: Optional[datetime] = None
    cervical_dilatation: Optional[float] = None
    fetal_heart_rate: Optional[int] = None
    alert: Optional[bool] = None
    risk_alerts: Optional[List[Any]] = None
    model_config = {"from_attributes": True}

# ── Delivery ─────────────────────────────────────────────────────
class DeliveryCreate(BaseModel):
    visit_id: UUID
    institution_id: UUID
    date_of_delivery: datetime
    mode_of_delivery: str
    presentation: Optional[str] = None
    baby_sex: str
    birth_weight: Optional[float] = None
    apgar_score: Optional[Dict[str, int]] = None
    outcome: str
    complications: Optional[str] = None
    remarks: Optional[str] = None
    parity: Optional[int] = None

class DeliveryResponse(BaseModel):
    id: UUID
    visit_id: UUID
    date_of_delivery: datetime
    mode_of_delivery: str
    baby_sex: str
    birth_weight: Optional[float] = None
    outcome: str
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

# ── PNC ──────────────────────────────────────────────────────────
class PNCCreate(BaseModel):
    visit_id: UUID
    institution_id: UUID
    auditor_id: UUID
    mother_condition: str
    baby_condition: str
    baby_weight_kg: Optional[float] = None
    breastfeeding_status: Optional[str] = None
    follow_up_needed: Optional[bool] = False

class PNCResponse(BaseModel):
    id: UUID
    visit_id: UUID
    pnc_number: str
    mother_condition: str
    baby_condition: str
    follow_up_needed: Optional[bool] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

# ── Ultrasound ───────────────────────────────────────────────────
class UltrasoundCreate(BaseModel):
    visit_id: UUID
    department_id: UUID
    gestational_age: Optional[int] = None
    scan_type: Optional[str] = "Transabdominal"
    indication: Optional[str] = None
    findings: Optional[Dict[str, Any]] = None
    conclusion: Optional[str] = None
    performed_by: Optional[UUID] = None

class UltrasoundResponse(BaseModel):
    id: UUID
    visit_id: UUID
    gestational_age: Optional[int] = None
    scan_type: Optional[str] = None
    conclusion: Optional[str] = None
    date: Optional[date] = None
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

# ── Fluid Monitoring ─────────────────────────────────────────────
class FluidEntryCreate(BaseModel):
    visit_id: UUID
    institution_id: UUID
    staff_id: UUID
    type: str  # intake/output
    category: str  # oral/iv/urine/stool etc
    amount: float
    unit: Optional[str] = "ml"
    description: Optional[str] = None
    color: Optional[str] = None
    consistency: Optional[str] = None
    method: Optional[str] = None
    fluid_type: Optional[str] = None
    iv_solution: Optional[str] = None
    iv_rate: Optional[float] = None
    recorded_at: Optional[datetime] = None
    notes: Optional[str] = None

class FluidEntryResponse(BaseModel):
    id: UUID
    visit_id: UUID
    type: str
    category: str
    amount: float
    unit: Optional[str] = None
    recorded_at: Optional[datetime] = None
    status: Optional[str] = None
    model_config = {"from_attributes": True}

class FluidSummaryResponse(BaseModel):
    id: UUID
    visit_id: UUID
    summary_date: Optional[date] = None
    total_intake: Optional[float] = None
    total_output: Optional[float] = None
    net_balance: Optional[float] = None
    status: Optional[str] = None
    model_config = {"from_attributes": True}

# ── Dashboard ────────────────────────────────────────────────────
class MaternityDashboard(BaseModel):
    active_anc_patients: int = 0
    active_labour_patients: int = 0
    deliveries_this_month: int = 0
    anc_visits_this_month: int = 0
    high_risk_patients: int = 0
