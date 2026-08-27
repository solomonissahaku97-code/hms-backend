const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * PrescriptionItem - A single medication line item within a prescription.
 * A prescription can have multiple items (e.g., antibiotics + painkillers).
 */
const PrescriptionItem = sequelize.define('PrescriptionItem', {
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
  medication_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'medications', key: 'id' },
  },
  dosage: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'e.g., 500mg, 10ml',
  },
  frequency: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'e.g., Twice daily, Every 8 hours',
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Duration in days',
  },
  quantity_prescribed: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Total quantity prescribed',
  },
  quantity_dispensed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Quantity actually dispensed',
  },
  route: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'e.g., Oral, IV, IM, Topical',
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Special instructions (e.g., take with food)',
  },
  refill_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('pending', 'dispensed', 'partially_dispensed', 'canceled'),
    defaultValue: 'pending',
  },
  dispensed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'PrescriptionItem',
  tableName: 'prescription_items',
  timestamps: true,
  indexes: [
    { fields: ['prescription_id'] },
    { fields: ['medication_id'] },
    { fields: ['prescription_id', 'status'] },
  ],
});

PrescriptionItem.associate = (models) => {
  PrescriptionItem.belongsTo(models.Prescription, { foreignKey: 'prescription_id', as: 'prescription' });
  PrescriptionItem.belongsTo(models.Medication, { foreignKey: 'medication_id', as: 'medication' });
  PrescriptionItem.hasMany(models.DispenseRecord, { foreignKey: 'prescription_item_id', as: 'dispenseRecords' });
};

module.exports = PrescriptionItem;
