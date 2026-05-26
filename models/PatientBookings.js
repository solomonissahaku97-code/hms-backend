const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const PatientBookings = sequelize.define('patient_bookings', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,

    defaultValue: DataTypes.UUIDV4
  },
  institution_id: {
    type: DataTypes.UUID,
    references: {
      model: Institution,
      key: 'id',
    },
    allowNull: false,
  },
  full_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  consultation_type: {
    type: DataTypes.ENUM(
      'General Check-Up',
      'Pediatrics',
      'Cardiology',
      'Dermatology',
      'Gynecology'
    ),
    allowNull: false,
  },
  phone_number: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      is: /^[0-9]+$/i, // Ensure it contains only numbers
    },
  },
  appointment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  start_time: {
    type: DataTypes.TIME, // Store as TIME type in database
    allowNull: false,
  },
  end_time: {
    type: DataTypes.TIME, // Store as TIME type in database
    allowNull: false,
  },
  additional_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = PatientBookings;
