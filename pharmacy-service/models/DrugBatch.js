const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * DrugBatch - Tracks inventory batches per institution.
 * Each batch has its own expiry date, quantity, and pricing.
 * This is the core inventory model for the pharmacy.
 */
const DrugBatch = sequelize.define('DrugBatch', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  medication_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'medications', key: 'id' },
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Institution this batch belongs to',
  },
  batch_number: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Supplier batch/lot number',
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Original quantity received',
  },
  current_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Current available quantity',
  },
  unit_cost: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Cost per unit from supplier',
  },
  selling_price: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    comment: 'Price charged to patient',
  },
  nhia_price: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
    comment: 'NHIA-covered price (if applicable)',
  },
  supplier_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  supplier_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Denormalized supplier name for quick lookups',
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  manufacture_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  received_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Shelf/zone within the pharmacy',
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'depleted', 'recalled', 'quarantined'),
    defaultValue: 'active',
  },
  reorder_level: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Minimum quantity before reorder alert',
  },
  critical_level: {
    type: DataTypes.INTEGER,
    defaultValue: 3,
    comment: 'Critical low-stock threshold',
  },
}, {
  sequelize,
  modelName: 'DrugBatch',
  tableName: 'drug_batches',
  timestamps: true,
  indexes: [
    { fields: ['medication_id', 'institution_id'] },
    { fields: ['institution_id', 'status'] },
    { fields: ['batch_number'] },
    { fields: ['expiry_date'] },
    { fields: ['medication_id', 'institution_id', 'status'] },
  ],
});

DrugBatch.associate = (models) => {
  DrugBatch.belongsTo(models.Medication, { foreignKey: 'medication_id', as: 'medication' });
  DrugBatch.hasMany(models.DispenseRecord, { foreignKey: 'drug_batch_id', as: 'dispenseRecords' });
  DrugBatch.hasMany(models.InventoryLog, { foreignKey: 'drug_batch_id', as: 'inventoryLogs' });
};

module.exports = DrugBatch;
