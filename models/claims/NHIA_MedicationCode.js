const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const NHIAMedication = sequelize.define('Medication', {
  code: {
    type: DataTypes.STRING,  // e.g., "ACETAZIN1"
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,  // e.g., "Acetazolamide"
    allowNull: false
  },
  form: {
    type: DataTypes.STRING,  // e.g., "Injection, 500 mg"
    allowNull: true
  },
  unit: {
    type: DataTypes.STRING,  // e.g., "Ampoule", "Tablet"
    allowNull: true
  },
  price: {
    type: DataTypes.FLOAT,   // e.g., 41.25
    allowNull: false
  },
  prescribing_level: {
    type: DataTypes.STRING,  // e.g., "C", "B1"
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'medications',
});

module.exports = NHIAMedication;
