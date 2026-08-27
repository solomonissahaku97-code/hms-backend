/**
 * Lab Service — Models Index
 *
 * Loads all lab-specific models and sets up associations.
 * Read-only references to Staff, Patient, Visit, etc. are minimal
 * stubs for JOIN queries — the actual data lives in the monolith.
 */

const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const db = {};

// ── Load lab models ──────────────────────────────────────────────────
const labModelFiles = [
  'LabTestResult.js',
  'LabTestTemplate.js',
  'LabTestField.js',
  'LabRanges.js',
  'InstitutionLabReferenceRange.js',
  'InstitutionLabTariff.js',
  'LabInvestigation.js',
  'LabResultShareToken.js',
];

labModelFiles.forEach((file) => {
  const model = require(path.join(__dirname, file));
  db[model.name] = model;
});

// ── Read-only reference models (minimal stubs for JOINs) ─────────────
const { DataTypes } = require('sequelize');

db.Staff = sequelize.define('Staff', {
  id: { type: DataTypes.UUID, primaryKey: true },
  firstName: { type: DataTypes.STRING },
  lastName: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  department_id: { type: DataTypes.UUID },
  institution_id: { type: DataTypes.UUID },
}, { tableName: 'staffs', timestamps: false });

db.Patient = sequelize.define('Patient', {
  id: { type: DataTypes.UUID, primaryKey: true },
  first_name: { type: DataTypes.STRING },
  last_name: { type: DataTypes.STRING },
  middle_name: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  gender: { type: DataTypes.STRING },
  date_of_birth: { type: DataTypes.DATE },
  folder_number: { type: DataTypes.STRING },
  institution_id: { type: DataTypes.UUID },
}, { tableName: 'patients', timestamps: true });

db.Visit = sequelize.define('Visit', {
  id: { type: DataTypes.UUID, primaryKey: true },
  patient_id: { type: DataTypes.UUID },
  institution_id: { type: DataTypes.UUID },
  department_id: { type: DataTypes.UUID },
  status: { type: DataTypes.STRING },
  attendance_number: { type: DataTypes.STRING },
}, { tableName: 'visits', timestamps: true });

db.Department = sequelize.define('Department', {
  id: { type: DataTypes.UUID, primaryKey: true },
  name: { type: DataTypes.STRING },
  institution_id: { type: DataTypes.UUID },
  departmentType: { type: DataTypes.STRING },
}, { tableName: 'departments', timestamps: true });

db.Institution = sequelize.define('Institution', {
  id: { type: DataTypes.UUID, primaryKey: true },
  name: { type: DataTypes.STRING },
  address: { type: DataTypes.STRING },
  contact: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  logo_url: { type: DataTypes.STRING },
}, { tableName: 'institutions', timestamps: true });

db.Claim = sequelize.define('Claim', {
  id: { type: DataTypes.UUID, primaryKey: true },
}, { tableName: 'claims', timestamps: true });

db.Diagnosis = sequelize.define('Diagnosis', {
  id: { type: DataTypes.UUID, primaryKey: true },
}, { tableName: 'diagnoses', timestamps: true });

db.SystemDiagnosis = sequelize.define('systemDiagnosis', {
  id: { type: DataTypes.UUID, primaryKey: true },
}, { tableName: 'system_diagnoses', timestamps: false });

// ── Associations ─────────────────────────────────────────────────────

// LabTestResult
if (db.LabTestResult.associate) db.LabTestResult.associate(db);
if (db.LabTestTemplate.associate) db.LabTestTemplate.associate(db);
if (db.LabTestField.associate) db.LabTestField.associate(db);
if (db.LabRanges.associate) db.LabRanges.associate(db);
if (db.InstitutionLabReferenceRange.associate) db.InstitutionLabReferenceRange.associate(db);
if (db.InstitutionLabTariff.associate) db.InstitutionLabTariff.associate(db);
if (db.LabResultShareToken.associate) db.LabResultShareToken.associate(db);

db.sequelize = sequelize;
module.exports = db;
