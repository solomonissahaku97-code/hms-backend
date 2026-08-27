const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * PharmacyAudit - General audit log for pharmacy operations.
 * Captures who did what, when, and why.
 */
const PharmacyAudit = sequelize.define('PharmacyAudit', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  prescription_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'pharmacy_prescriptions', key: 'id' },
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'e.g., prescription.created, dispensing.completed, stock.adjusted',
  },
  actor_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Staff ID who performed the action',
  },
  actor_role: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Role at time of action (e.g., pharmacist, doctor)',
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Type of entity affected (e.g., prescription, batch, medication)',
  },
  entity_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID of the entity affected',
  },
  old_values: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Previous state (for updates)',
  },
  new_values: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'New state (for creates/updates)',
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'PharmacyAudit',
  tableName: 'pharmacy_audits',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['prescription_id'] },
    { fields: ['actor_id'] },
    { fields: ['action'] },
    { fields: ['institution_id', 'created_at'] },
  ],
});

PharmacyAudit.associate = (models) => {
  PharmacyAudit.belongsTo(models.Prescription, { foreignKey: 'prescription_id', as: 'prescription' });
};

module.exports = PharmacyAudit;
