const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * InventoryLog - Tracks all inventory movements (in/out/adjustments).
 * Provides a complete audit trail for drug stock changes.
 */
const InventoryLog = sequelize.define('InventoryLog', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
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
  movement_type: {
    type: DataTypes.ENUM('received', 'dispensed', 'adjustment', 'expired', 'returned', 'transfer_in', 'transfer_out', 'recalled'),
    allowNull: false,
  },
  quantity_change: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Positive for stock in, negative for stock out',
  },
  previous_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Stock level before this movement',
  },
  new_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Stock level after this movement',
  },
  reference_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'e.g., dispensing, purchase, adjustment, transfer',
  },
  reference_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID of the related record (DispenseRecord, etc.)',
  },
  performed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Staff ID who performed the action',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'InventoryLog',
  tableName: 'inventory_logs',
  timestamps: true,
  indexes: [
    { fields: ['drug_batch_id'] },
    { fields: ['medication_id'] },
    { fields: ['institution_id', 'movement_type'] },
    { fields: ['institution_id', 'created_at'] },
  ],
});

InventoryLog.associate = (models) => {
  InventoryLog.belongsTo(models.DrugBatch, { foreignKey: 'drug_batch_id', as: 'drugBatch' });
  InventoryLog.belongsTo(models.Medication, { foreignKey: 'medication_id', as: 'medication' });
};

module.exports = InventoryLog;
