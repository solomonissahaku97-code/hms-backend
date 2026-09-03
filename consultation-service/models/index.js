const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// ── Core Consultation ───────────────────────────────────────────

const Consultation = sequelize.define('consultation', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  institution_id: { type: DataTypes.UUID, allowNull: false },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'approved'), defaultValue: 'pending' },
}, { tableName: 'consultation', timestamps: true });

const Diagnosis = sequelize.define('Diagnosis', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  staff_id: { type: DataTypes.UUID, allowNull: false },
  institution_id: { type: DataTypes.UUID, allowNull: true },
  system_diagnosis_id: { type: DataTypes.UUID, allowNull: true },
  diagnosis_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, allowNull: false },
  status: { type: DataTypes.ENUM('Active', 'Resolved', 'Pending'), defaultValue: 'Active' },
  chief_complain: { type: DataTypes.TEXT, allowNull: true },
  doctor_evaluation: { type: DataTypes.TEXT, allowNull: true },
  diagnosis_type: { type: DataTypes.ENUM('provisional_diagnosis', 'confirmed_diagnosis'), defaultValue: 'confirmed_diagnosis' },
  diagnosis_group_id: { type: DataTypes.UUID, allowNull: true, comment: 'Links multiple diagnoses added together' },
  department_id: { type: DataTypes.UUID, allowNull: true },
  patient_id: { type: DataTypes.UUID, allowNull: true },
}, { tableName: 'diagnosis', timestamps: true, underscored: true });

const Prescription = sequelize.define('Prescription', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  medication_id: { type: DataTypes.UUID, allowNull: true },
  department_id: { type: DataTypes.UUID, allowNull: true },
  visit_id: { type: DataTypes.UUID, allowNull: true },
  patient_id: { type: DataTypes.UUID, allowNull: true },
  institution_id: { type: DataTypes.UUID, allowNull: false },
  prescribing_staff_id: { type: DataTypes.UUID, allowNull: true },
  doctor_id: { type: DataTypes.UUID, allowNull: true },
  dosage: { type: DataTypes.STRING, allowNull: true },
  frequency: { type: DataTypes.STRING, allowNull: true },
  duration: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  quantity: { type: DataTypes.INTEGER, allowNull: true },
  route: { type: DataTypes.STRING, allowNull: true },
  doseUnitType: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.STRING, allowNull: true },
  pharmacist_note: { type: DataTypes.STRING, allowNull: true },
  refill: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  is_dispensed: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('pending', 'dispensed', 'canceled'), defaultValue: 'pending' },
  start_date: { type: DataTypes.DATE, allowNull: true },
  end_date: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'prescriptions', timestamps: true, underscored: true, paranoid: true });

// ── Patient History Models ──────────────────────────────────────

const PatientAllergy = sequelize.define('PatientAllergy', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  patient_id: { type: DataTypes.UUID, allowNull: false },
  institution_id: { type: DataTypes.UUID, allowNull: true },
  allergy_type: { type: DataTypes.ENUM('drug', 'food', 'environmental', 'biological', 'other'), allowNull: false },
  allergen: { type: DataTypes.STRING, allowNull: false },
  severity: { type: DataTypes.ENUM('mild', 'moderate', 'severe', 'anaphylaxis'), allowNull: false, defaultValue: 'mild' },
  reaction_type: { type: DataTypes.STRING, allowNull: true },
  reaction_description: { type: DataTypes.TEXT, allowNull: true },
  onset_date: { type: DataTypes.DATE, allowNull: true },
  last_reaction_date: { type: DataTypes.DATE, allowNull: true },
  is_confirmed: { type: DataTypes.BOOLEAN, defaultValue: false },
  identified_by: { type: DataTypes.UUID, allowNull: true },
  verification_status: { type: DataTypes.ENUM('unverified', 'verified', 'denied'), defaultValue: 'unverified' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  recorded_by: { type: DataTypes.UUID, allowNull: true },
}, { tableName: 'patient_allergies_consultation', timestamps: true });

const DrugHistory = sequelize.define('DrugHistory', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  drug_name: { type: DataTypes.STRING, allowNull: false },
  dosage: { type: DataTypes.STRING, allowNull: true },
  frequency: { type: DataTypes.STRING, allowNull: true },
  route: { type: DataTypes.STRING, allowNull: true },
  start_date: { type: DataTypes.DATE, allowNull: true },
  end_date: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'drug_histories', timestamps: true, paranoid: true });

const PastMedicalHistory = sequelize.define('PastMedicalHistory', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  condition: { type: DataTypes.STRING, allowNull: false },
  diagnosis_date: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.ENUM('active', 'resolved', 'chronic'), defaultValue: 'active' },
  treatment: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'past_medical_histories', timestamps: true, paranoid: true });

const PatientOccupation = sequelize.define('PatientOccupation', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  occupation: { type: DataTypes.STRING, allowNull: false },
  start_date: { type: DataTypes.DATE, allowNull: true },
  end_date: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'patient_occupations', timestamps: true, paranoid: true });

const FamilyHealthHistory = sequelize.define('FamilyHealthHistory', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  patient_id: { type: DataTypes.UUID, allowNull: false },
  institution_id: { type: DataTypes.UUID, allowNull: true },
  relationship: { type: DataTypes.ENUM('father', 'mother', 'brother', 'sister', 'grandfather', 'grandmother', 'uncle', 'aunt', 'cousin', 'other'), allowNull: false },
  first_name: { type: DataTypes.STRING, allowNull: true },
  age: { type: DataTypes.INTEGER, allowNull: true },
  is_deceased: { type: DataTypes.BOOLEAN, defaultValue: false },
  age_at_death: { type: DataTypes.INTEGER, allowNull: true },
  cause_of_death: { type: DataTypes.STRING, allowNull: true },
  conditions: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  condition_onset_age: { type: DataTypes.INTEGER, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  recorded_by: { type: DataTypes.UUID, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'family_health_histories', timestamps: true });

const PatientChronicCondition = sequelize.define('PatientChronicCondition', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  patient_id: { type: DataTypes.UUID, allowNull: false },
  institution_id: { type: DataTypes.UUID, allowNull: true },
  condition_name: { type: DataTypes.STRING, allowNull: false },
  condition_category: { type: DataTypes.ENUM('cardiovascular', 'respiratory', 'endocrine', 'neurological', 'musculoskeletal', 'renal', 'gastrointestinal', 'hematological', 'oncological', 'psychiatric', 'dermatological', 'other'), allowNull: false },
  icd10_code: { type: DataTypes.STRING, allowNull: true },
  stage: { type: DataTypes.STRING, allowNull: true },
  diagnosis_date: { type: DataTypes.DATE, allowNull: true },
  diagnosed_by: { type: DataTypes.UUID, allowNull: true },
  diagnosis_facility: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM('active', 'controlled', 'in_remission', 'resolved'), defaultValue: 'active' },
  treatment_type: { type: DataTypes.STRING, allowNull: true },
  current_medications: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  treatment_goals: { type: DataTypes.TEXT, allowNull: true },
  last_followup_date: { type: DataTypes.DATE, allowNull: true },
  next_followup_date: { type: DataTypes.DATE, allowNull: true },
  followup_frequency_days: { type: DataTypes.INTEGER, allowNull: true },
  complications: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  notes: { type: DataTypes.TEXT, allowNull: true },
  is_controlled: { type: DataTypes.BOOLEAN, defaultValue: false },
  last_hba1c: { type: DataTypes.DECIMAL(4, 2), allowNull: true },
  last_bp_reading: { type: DataTypes.STRING, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  recorded_by: { type: DataTypes.UUID, allowNull: true },
}, { tableName: 'patient_chronic_conditions', timestamps: true });

const PatientRiskAssessment = sequelize.define('PatientRiskAssessment', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  patient_id: { type: DataTypes.UUID, allowNull: false },
  institution_id: { type: DataTypes.UUID, allowNull: true },
  assessment_type: { type: DataTypes.ENUM('cardiovascular', 'diabetes', 'fall_risk'), allowNull: false },
  assessment_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  age: { type: DataTypes.INTEGER, allowNull: true },
  gender: { type: DataTypes.STRING, allowNull: true },
  risk_score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  risk_category: { type: DataTypes.ENUM('low', 'moderate', 'high', 'very_high'), allowNull: true },
  input_values: { type: DataTypes.JSONB, allowNull: true },
  risk_factors: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  protective_factors: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
  recommendations: { type: DataTypes.TEXT, allowNull: true },
  next_assessment_date: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.ENUM('in-progress', 'completed', 'cancelled'), defaultValue: 'in-progress' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  assessed_by: { type: DataTypes.UUID, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'patient_risk_assessments', timestamps: true });

const DoctorAvailability = require('./DoctorAvailability');
const PatientAppointment = require('./PatientAppointment');

module.exports = {
  sequelize, Consultation, Diagnosis, Prescription,
  PatientAllergy, DrugHistory, PastMedicalHistory, PatientOccupation,
  FamilyHealthHistory, PatientChronicCondition, PatientRiskAssessment,
  DoctorAvailability, PatientAppointment,
};
