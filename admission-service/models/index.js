const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const db = {};

// ── Load admission models ─────────────────────────────────────────
db.Admission = require('./Admission');
db.Bed = require('./Bed');
db.Discharge = require('./Discharge');

// ── Read-only stubs (data lives in main HMS backend) ─────────────
db.Visit = sequelize.define('Visit', {
  id: { type: DataTypes.UUID, primaryKey: true },
  patient_id: { type: DataTypes.UUID },
  institution_id: { type: DataTypes.UUID },
  department_id: { type: DataTypes.UUID },
  status: { type: DataTypes.STRING },
  on_admission: { type: DataTypes.BOOLEAN },
  admission_date: { type: DataTypes.DATE },
  discharge_date: { type: DataTypes.DATE },
  bed_number: { type: DataTypes.STRING },
  admission_status: { type: DataTypes.STRING },
  admission_note: { type: DataTypes.TEXT },
}, { tableName: 'visits', timestamps: true });

db.Patient = sequelize.define('Patient', {
  id: { type: DataTypes.UUID, primaryKey: true },
  first_name: { type: DataTypes.STRING },
  last_name: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING },
}, { tableName: 'patients', timestamps: true });

db.Staff = sequelize.define('Staff', {
  id: { type: DataTypes.UUID, primaryKey: true },
  firstName: { type: DataTypes.STRING },
  lastName: { type: DataTypes.STRING },
}, { tableName: 'staffs', timestamps: false });

db.Department = sequelize.define('Department', {
  id: { type: DataTypes.UUID, primaryKey: true },
  name: { type: DataTypes.STRING },
  institution_id: { type: DataTypes.UUID },
}, { tableName: 'departments', timestamps: true });

db.Institution = sequelize.define('Institution', {
  id: { type: DataTypes.UUID, primaryKey: true },
  name: { type: DataTypes.STRING },
}, { tableName: 'institutions', timestamps: true });

// ── Run associations ──────────────────────────────────────────────
Object.values(db).forEach((model) => {
  if (model.associate) model.associate(db);
});

db.sequelize = sequelize;
module.exports = db;
