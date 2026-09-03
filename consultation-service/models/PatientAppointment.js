const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Patient Appointment — a booked appointment for a patient with a doctor.
 *
 * Created when a patient completes the booking flow in the patient app.
 * The backend is the source of truth for slot availability and double-booking prevention.
 */
const PatientAppointment = sequelize.define('PatientAppointment', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  patient_id: {
    // References patients.id in the shared HMS database
    type: DataTypes.UUID,
    allowNull: false,
  },
  doctor_id: {
    // References staffs.id in the shared HMS database
    type: DataTypes.UUID,
    allowNull: false,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  department_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  appointment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  appointment_time: {
    // Stored as "HH:MM" 24-hour string (e.g. "10:30")
    type: DataTypes.STRING(5),
    allowNull: false,
  },
  slot_duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled'),
    defaultValue: 'scheduled',
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    // Additional information for the doctor
    type: DataTypes.TEXT,
    allowNull: true,
  },
  cancelled_by: {
    type: DataTypes.ENUM('patient', 'doctor', 'admin'),
    allowNull: true,
  },
  cancellation_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
}, {
  tableName: 'patient_appointments',
  timestamps: true,
  indexes: [
    { fields: ['patient_id'] },
    { fields: ['doctor_id'] },
    { fields: ['institution_id'] },
    { fields: ['department_id'] },
    { fields: ['appointment_date'] },
    { fields: ['doctor_id', 'appointment_date', 'appointment_time'], unique: true },
    { fields: ['status'] },
    { fields: ['token'], unique: true },
  ],
});

module.exports = PatientAppointment;
