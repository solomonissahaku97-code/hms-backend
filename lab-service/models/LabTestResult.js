const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LabTestResult = sequelize.define('LabTestResult', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sample_number: { type: DataTypes.STRING, allowNull: true },
  visit_id: { type: DataTypes.UUID, allowNull: true },
  patient_id: { type: DataTypes.UUID, allowNull: false },
  institution_id: { type: DataTypes.UUID, allowNull: false },
  department_id: { type: DataTypes.UUID, allowNull: true },
  templateId: { type: DataTypes.UUID, allowNull: false },
  values: { type: DataTypes.JSON, allowNull: true },
  attachments: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  abnormal_flags: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  notes: DataTypes.TEXT,
  request_notes: { type: DataTypes.TEXT, allowNull: true },
  technician_notes: { type: DataTypes.TEXT, allowNull: true },
  specimen_type: { type: DataTypes.STRING, allowNull: true },
  specimen_condition: { type: DataTypes.STRING, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'in-progress', 'completed', 'verified', 'released', 'rejected', 'cancelled'),
    allowNull: false, defaultValue: 'pending',
  },
  rejection_reason: { type: DataTypes.TEXT, allowNull: true },
  rerun_of_id: { type: DataTypes.UUID, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
  verifiedBy: { type: DataTypes.UUID, allowNull: true },
  releasedBy: { type: DataTypes.UUID, allowNull: true },
  releasedAt: { type: DataTypes.DATE, allowNull: true },
  tat_started_at: { type: DataTypes.DATE, allowNull: true },
  tat_completed_at: { type: DataTypes.DATE, allowNull: true },
  tat_minutes: { type: DataTypes.INTEGER, allowNull: true },
  referral_id: { type: DataTypes.UUID, allowNull: true },
}, {
  timestamps: true,
  tableName: 'lab_test_results',
});

LabTestResult.associate = (models) => {
  LabTestResult.belongsTo(models.LabTestTemplate, { foreignKey: 'templateId', as: 'template' });
  LabTestResult.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
  LabTestResult.belongsTo(models.Staff, { foreignKey: 'createdBy', as: 'creator' });
  LabTestResult.belongsTo(models.Staff, { foreignKey: 'verifiedBy', as: 'verifier' });
  LabTestResult.belongsTo(models.Staff, { foreignKey: 'releasedBy', as: 'releaser' });
  LabTestResult.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
  LabTestResult.belongsTo(models.LabTestResult, { foreignKey: 'rerun_of_id', as: 'rerunOf' });
};

module.exports = LabTestResult;
