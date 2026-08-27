const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * DispenseRecord - Records every dispensing event.
 * Tracks which batch was used, quantity dispensed, and pricing.
 * This is the audit trail for pharmacy dispensing.
 */
const DispenseRecord = sequelize.define('DispenseRecord', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  prescription_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'pharmacy_prescriptions', key: 'id' },
  },
  prescription_item_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'prescription_items', key: 'id' },
  },
  drug_batch_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'drug_batches', key: 'id' },
  },
  medication_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'medications', key: 'id' },
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  patient_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  quantity_dispensed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Number of units dispensed',
  },
  unit_price: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'Price per unit at time of dispensing',
  },
  total_price: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    comment: 'unit_price × quantity_dispensed',
  },
  nhia_price: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
    comment: 'NHIA-covered amount',
  },
  dispensed_by: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Staff ID of the pharmacist',
  },
  dispensed_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  pharmacist_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  batch_number_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Snapshot of batch number at dispensing time',
  },
  billing_reference: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Billing details from the billing service',
  },
}, {
  sequelize,
  modelName: 'DispenseRecord',
  tableName: 'dispense_records',
  timestamps: true,
  indexes: [
    { fields: ['prescription_id'] },
    { fields: ['prescription_item_id'] },
    { fields: ['drug_batch_id'] },
    { fields: ['medication_id'] },
    { fields: ['institution_id', 'dispensed_at'] },
    { fields: ['patient_id'] },
    { fields: ['dispensed_by'] },
  ],
});

DispenseRecord.associate = (models) => {
  DispenseRecord.belongsTo(models.Prescription, { foreignKey: 'prescription_id', as: 'prescription' });
  DispenseRecord.belongsTo(models.PrescriptionItem, { foreignKey: 'prescription_item_id', as: 'prescriptionItem' });
  DispenseRecord.belongsTo(models.DrugBatch, { foreignKey: 'drug_batch_id', as: 'drugBatch' });
  DispenseRecord.belongsTo(models.Medication, { foreignKey: 'medication_id', as: 'medication' });
};

module.exports = DispenseRecord;
