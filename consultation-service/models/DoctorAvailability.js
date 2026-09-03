const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Doctor Availability — recurring weekly schedule.
 *
 * A single row represents "this doctor is available every Monday 09:00–12:00
 * with 30-minute slots" at a given institution/department.
 */
const DoctorAvailability = sequelize.define('DoctorAvailability', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  doctor_id: {
    // References staffs.id in the shared HMS database
    type: DataTypes.UUID,
    allowNull: false,
  },
  institution_id: {
    // References institutions.id in the shared HMS database
    type: DataTypes.UUID,
    allowNull: false,
  },
  department_id: {
    // References departments.id in the shared HMS database
    type: DataTypes.UUID,
    allowNull: false,
  },
  day_of_week: {
    type: DataTypes.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
    allowNull: false,
  },
  start_time: {
    // Stored as "HH:MM" 24-hour string (e.g. "09:00")
    type: DataTypes.STRING(5),
    allowNull: false,
  },
  end_time: {
    type: DataTypes.STRING(5),
    allowNull: false,
  },
  slot_duration: {
    // Duration of each appointment slot in minutes
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
  },
  break_start: {
    // Optional break period (e.g. lunch)
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  break_end: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'doctor_availability',
  timestamps: true,
  indexes: [
    { fields: ['doctor_id'] },
    { fields: ['institution_id'] },
    { fields: ['department_id'] },
    { fields: ['doctor_id', 'institution_id', 'department_id'] },
    { fields: ['day_of_week'] },
  ],
});

module.exports = DoctorAvailability;
