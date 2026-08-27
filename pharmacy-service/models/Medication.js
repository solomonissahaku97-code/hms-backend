const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Medication - Global drug catalog.
 * Each medication is institution-agnostic (shared across institutions).
 * Institution-specific pricing is handled by DrugBatch.
 */
const Medication = sequelize.define('Medication', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  generic_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  brand_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'e.g., Antibiotic, Analgesic, Antimalarial',
  },
  form: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'e.g., Tablet, Capsule, Syrup, Injection, Cream',
  },
  strength: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'e.g., 500mg, 10mg/ml',
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'e.g., tablets, capsules, ml, vials',
  },
  manufacturer: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  requires_prescription: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_controlled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Controlled substance flag',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  sequelize,
  modelName: 'Medication',
  tableName: 'medications',
  timestamps: true,
  indexes: [
    { fields: ['generic_name'], unique: true },
    { fields: ['category'] },
    { fields: ['is_active'] },
  ],
});

Medication.associate = (models) => {
  Medication.hasMany(models.DrugBatch, { foreignKey: 'medication_id', as: 'batches' });
  Medication.hasMany(models.PrescriptionItem, { foreignKey: 'medication_id', as: 'prescriptionItems' });
};

module.exports = Medication;
