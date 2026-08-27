const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Prescription - Represents a doctor's prescription order.
 * Links to the main HMS patient/visit system via external IDs.
 * Contains one or more PrescriptionItems.
 */
const Prescription = sequelize.define('Prescription', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  // External references to the main HMS system
  patient_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Reference to patient in main HMS',
  },
  visit_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Reference to visit in main HMS',
  },
  doctor_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Prescribing doctor/staff ID',
  },
  department_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Department that prescribed',
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Prescription metadata
  prescription_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: 'Auto-generated prescription number',
  },
  diagnosis: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Brief diagnosis/indication',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_emergency: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  priority: {
    type: DataTypes.ENUM('routine', 'urgent', 'stat'),
    defaultValue: 'routine',
  },
  // Lifecycle
  status: {
    type: DataTypes.ENUM('pending', 'partially_dispensed', 'dispensed', 'canceled', 'expired'),
    defaultValue: 'pending',
  },
  dispensed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Staff ID of pharmacist who dispensed',
  },
  dispensed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  canceled_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  canceled_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  cancel_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Dates
  prescribed_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Prescription expiry date',
  },
}, {
  sequelize,
  modelName: 'Prescription',
  tableName: 'pharmacy_prescriptions',
  timestamps: true,
  paranoid: true, // Soft deletes
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['patient_id'] },
    { fields: ['visit_id'] },
    { fields: ['prescription_number'], unique: true },
    { fields: ['status'] },
    { fields: ['institution_id', 'status'] },
    { fields: ['institution_id', 'patient_id'] },
  ],
});

Prescription.associate = (models) => {
  Prescription.hasMany(models.PrescriptionItem, { foreignKey: 'prescription_id', as: 'items' });
  Prescription.hasMany(models.DispenseRecord, { foreignKey: 'prescription_id', as: 'dispenseRecords' });
  Prescription.hasMany(models.PharmacyAudit, { foreignKey: 'prescription_id', as: 'auditLogs' });
};

/**
 * Auto-generate prescription number before creation
 */
Prescription.beforeCreate(async (prescription) => {
  if (!prescription.prescription_number) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    prescription.prescription_number = `RX-${timestamp}-${random}`;
  }
});

module.exports = Prescription;
