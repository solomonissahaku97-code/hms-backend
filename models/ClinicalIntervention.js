const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Staff = require('./staff');
const Medicine = require('./claims/medication');
const Visit = require('./Visit');
const Prescription = require('./prescription');

const ClinicalIntervention = sequelize.define('ClinicalIntervention', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  prescription_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Prescription,
      key: 'id'
    }
  },
  issue_type: {
    type: DataTypes.ENUM(
      'dosage_error',
      'duplicate_therapy',
      'allergy_alert',
      'drug_interaction',
      'contraindication',
      'other'
    ),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  severity: {
    type: DataTypes.ENUM('minor', 'moderate', 'major', 'life-threatening'),
    allowNull: false
  },
  prescriber_response: {
    type: DataTypes.ENUM('accepted', 'rejected', 'modified', 'pending'),
    defaultValue: 'pending'
  },
  outcome: {
    type: DataTypes.STRING,
    allowNull: true
  },
  intervened_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Staff,
      key: 'id'
    }
  },
  intervention_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  visit_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Visit,
      key: 'id'
    }
  }
}, {
  tableName: 'clinical_interventions',
  timestamps: true
});

ClinicalIntervention.associate = (models) => {
  ClinicalIntervention.belongsTo(models.Prescription, { foreignKey: 'prescription_id', as: 'prescription' });
  ClinicalIntervention.belongsTo(models.Staff, { foreignKey: 'intervened_by', as: 'intervenedBy' });
  ClinicalIntervention.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
};

module.exports = ClinicalIntervention;
