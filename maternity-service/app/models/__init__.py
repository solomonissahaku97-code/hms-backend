from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Date, Text, Enum, JSON, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base
import uuid
from datetime import datetime

# ── ANC Record ───────────────────────────────────────────────────

class ANC(Base):
    __tablename__ = "anc_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    institution_id = Column(UUID(as_uuid=True), nullable=False)
    anc_number = Column(String, unique=True, nullable=True)
    year = Column(Integer, nullable=True)
    mother_age = Column(Integer)
    parity = Column(Integer)
    gestational_age_weeks = Column(Integer)
    blood_pressure = Column(String)
    hemoglobin_level = Column(Float)
    hiv_status = Column(Enum("Positive", "Negative", "Unknown", name="hiv_status_enum"))
    auditor_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(Enum("Active", "In Labour", "Completed", name="anc_status_enum"), default="Active")
    risk_level = Column(Enum("Low", "Medium", "High", "Very High", name="risk_level_enum"), default="Low")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ── Pregnancy Timeline ───────────────────────────────────────────

class PregnancyTimeline(Base):
    __tablename__ = "pregnancy_timelines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    pregnancy_id = Column(UUID(as_uuid=True), nullable=False)
    lmp = Column(Date, nullable=False, comment="Last Menstrual Period")
    edd = Column(Date, nullable=False, comment="Expected Delivery Date")
    current_week = Column(Integer, default=1)
    total_weeks = Column(Integer, default=40)
    progress_percent = Column(Float, default=0.0)
    weeks = Column(JSONB, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ── Partograph ───────────────────────────────────────────────────

class Partograph(Base):
    __tablename__ = "partographs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    record_time = Column(DateTime, default=datetime.utcnow)
    cervical_dilatation = Column(Float)
    descent_of_head = Column(Float)
    fetal_heart_rate = Column(Integer)
    contractions_frequency = Column(Integer)
    contractions_strength = Column(Enum("Mild", "Moderate", "Strong", name="contraction_strength_enum"))
    pulse = Column(Integer)
    temperature = Column(Float)
    blood_pressure = Column(String)
    bp_systolic = Column(Integer)
    bp_diastolic = Column(Integer)
    urine_protein = Column(String)
    urine_acetone = Column(String)
    urine_volume = Column(Float)
    drugs_administered = Column(Text)
    iv_fluids = Column(Text)
    labour_start_time = Column(DateTime)
    remark = Column(Text)
    remarks = Column(Text)
    alert = Column(Boolean, default=False)
    action = Column(Boolean, default=False)
    risk_alerts = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)

# ── Delivery Register ────────────────────────────────────────────

class DeliveryRegister(Base):
    __tablename__ = "delivery_register"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    institution_id = Column(UUID(as_uuid=True), nullable=False)
    date_of_delivery = Column(DateTime, nullable=False)
    parity = Column(Integer)
    mode_of_delivery = Column(Enum("SVD", "Assisted", "Caesarean", "Other", name="delivery_mode_enum"), nullable=False)
    presentation = Column(Enum("Cephalic", "Breech", "Transverse", "Other", name="presentation_enum"))
    baby_sex = Column(Enum("Male", "Female", "Unknown", name="baby_sex_enum"), nullable=False)
    birth_weight = Column(Float)
    apgar_score = Column(JSON)
    outcome = Column(Enum("Alive", "Stillbirth", "Neonatal Death", name="outcome_enum"), nullable=False)
    complications = Column(Enum("PPH", "Eclampsia", "Obstructed Labour", "Sepsis", "Other", name="complication_enum"))
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

# ── PNC (Post-Natal Care) ───────────────────────────────────────

class PNC(Base):
    __tablename__ = "pnc_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    institution_id = Column(UUID(as_uuid=True), nullable=False)
    pnc_number = Column(String, unique=True, nullable=False)
    year = Column(Integer, nullable=False)
    mother_condition = Column(Enum("Good", "Complicated", "Needs Attention", "Other", name="mother_condition_enum"), nullable=False)
    baby_condition = Column(Enum("Healthy", "Needs Attention", "Sick", "Other", name="baby_condition_enum"), nullable=False)
    baby_weight_kg = Column(Float)
    breastfeeding_status = Column(Enum("Exclusive", "Mixed", "Not Breastfeeding", name="breastfeeding_enum"))
    follow_up_needed = Column(Boolean, default=False)
    auditor_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# ── Ultrasound ───────────────────────────────────────────────────

class Ultrasound(Base):
    __tablename__ = "ultrasounds"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    department_id = Column(UUID(as_uuid=True), nullable=False)
    gestational_age = Column(Integer)
    scan_type = Column(Enum("Transabdominal", "Transvaginal", name="scan_type_enum"), default="Transabdominal")
    indication = Column(String)
    findings = Column(JSON)
    conclusion = Column(Text)
    images = Column(JSON, default=[])
    performed_by = Column(UUID(as_uuid=True))
    date = Column(Date, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

# ── Maternity Audit ──────────────────────────────────────────────

class MaternityAudit(Base):
    __tablename__ = "maternity_audits"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    institution_id = Column(UUID(as_uuid=True), nullable=False)
    audit_number = Column(String, unique=True, nullable=False)
    year = Column(Integer, nullable=False)
    mother_age = Column(Integer)
    parity = Column(Integer)
    mode_of_delivery = Column(Enum("SVD", "Assisted", "Caesarean", "Other", name="audit_delivery_mode_enum"), nullable=False)
    anesthesia_type = Column(Enum("Spinal", "General", "Other", name="anesthesia_enum"))
    baby_outcome = Column(Enum("Alive with Mother", "Alive without Mother", "Stillborn", "Other", name="baby_outcome_enum"), nullable=False)
    baby_death_timing = Column(Enum("<24h", "24-48h", "48h-7days", ">=7days", name="death_timing_enum"))
    cause_of_death = Column(Enum("Bleeding", "Convulsion", "Vomiting", "Anaemia", "Severe cough", "Jaundice", "Other", name="cause_of_death_enum"))
    auditor_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# ── Fluid Monitoring ─────────────────────────────────────────────

class FluidMonitoring(Base):
    __tablename__ = "fluid_monitoring"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    institution_id = Column(UUID(as_uuid=True), nullable=False)
    staff_id = Column(UUID(as_uuid=True), nullable=False)
    type = Column(Enum("intake", "output", name="fluid_type_enum"), nullable=False)
    category = Column(Enum("oral", "iv", "ng_tube", "other_intake", "urine", "stool", "vomit", "drain", "other_output", name="fluid_category_enum"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    unit = Column(Enum("ml", "l", "oz", name="fluid_unit_enum"), default="ml")
    description = Column(Text)
    color = Column(Enum("clear", "pale_yellow", "yellow", "dark_yellow", "amber", "brown", "red", "other", name="fluid_color_enum"))
    consistency = Column(Enum("liquid", "soft", "formed", "hard", "watery", "mucoid", "bloody", name="fluid_consistency_enum"))
    method = Column(Enum("spontaneous", "catheter", "condom", "ileostomy", "colostomy", "ng_tube", "iv_line", name="fluid_method_enum"))
    fluid_type = Column(Enum("water", "juice", "soup", "normal_saline", "dextrose", "ringers_lactate", "blood", "other", name="fluid_substance_enum"))
    iv_solution = Column(String)
    iv_rate = Column(Numeric(8, 2))
    iv_rate_unit = Column(Enum("ml/hr", "drops/min", name="iv_rate_unit_enum"))
    recorded_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum("active", "completed", "cancelled", "voided", name="fluid_status_enum"), default="active")
    notes = Column(Text)
    is_void = Column(Boolean, default=False)
    void_reason = Column(Text)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    updated_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ── Fluid Balance Summary ────────────────────────────────────────

class FluidBalanceSummary(Base):
    __tablename__ = "fluid_balance_summaries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    institution_id = Column(UUID(as_uuid=True), nullable=False)
    summary_date = Column(Date, nullable=False)
    total_intake = Column(Numeric(10, 2), default=0)
    total_output = Column(Numeric(10, 2), default=0)
    net_balance = Column(Numeric(10, 2), default=0)
    oral_intake = Column(Numeric(10, 2), default=0)
    iv_intake = Column(Numeric(10, 2), default=0)
    other_intake = Column(Numeric(10, 2), default=0)
    urine_output = Column(Numeric(10, 2), default=0)
    stool_output = Column(Numeric(10, 2), default=0)
    vomit_output = Column(Numeric(10, 2), default=0)
    other_output = Column(Numeric(10, 2), default=0)
    status = Column(Enum("balanced", "positive_balance", "negative_balance", "critical", name="balance_status_enum"), default="balanced")
    alerts = Column(JSON, default=[])
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ── Fluid Monitoring Settings ────────────────────────────────────

class FluidMonitoringSettings(Base):
    __tablename__ = "fluid_monitoring_settings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), nullable=False)
    institution_id = Column(UUID(as_uuid=True), nullable=False)
    target_daily_intake = Column(Numeric(10, 2), default=2000)
    target_daily_output = Column(Numeric(10, 2), default=1500)
    alert_threshold_positive = Column(Numeric(10, 2), default=500)
    alert_threshold_negative = Column(Numeric(10, 2), default=-500)
    critical_threshold_positive = Column(Numeric(10, 2), default=1000)
    critical_threshold_negative = Column(Numeric(10, 2), default=-1000)
    measurement_unit = Column(Enum("ml", "l", "oz", name="settings_unit_enum"), default="ml")
    monitoring_frequency = Column(Enum("continuous", "hourly", "2hourly", "4hourly", "8hourly", "12hourly", "daily", name="frequency_enum"), default="4hourly")
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
