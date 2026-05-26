const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database'); // adjust as needed

const ICD10ToGDRG = sequelize.define('ICD10ToGDRG', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  gdrg_code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  gdrg_description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  condition: {
    type: DataTypes.STRING,
    defaultValue: "None"
  },
  icd10_codes: {
    type: DataTypes.ARRAY(DataTypes.STRING), // PostgreSQL
    allowNull: false
  },
  icd10_diagnoses: {
    type: DataTypes.ARRAY(DataTypes.STRING), // PostgreSQL
    allowNull: false
  }
}, {
  timestamps: true,
  tableName: 'icd10_to_gdrg'
});

module.exports = ICD10ToGDRG;
