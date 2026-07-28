const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const LabInvestigation = require('../claims/LabInvestigations');
const Staff = require('../staff');

const LabTestTemplate = sequelize.define('LabTestTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lab_tarrif_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  description: DataTypes.TEXT,
  specimen_types: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of allowed specimen type strings, e.g. ["blood", "urine"]'
  },
  turnaround_time_hours: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 24,
    comment: 'Expected TAT in hours for this template'
  },
  department_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
}, {
  sequelize,
  modelName: 'LabTestTemplate',
  tableName: 'lab_test_templates',
  timestamps: true,
  comment: 'Table to store lab test templates'
});

LabTestTemplate.associate = (models) => {
  LabTestTemplate.hasMany(models.LabTestField, {
    foreignKey: 'templateId',
    as: 'fields'
  });

  LabTestTemplate.hasMany(models.LabTestResult, {
    foreignKey: 'templateId',
    as: 'results'
  });
  LabTestTemplate.belongsTo(models.lab_investigation, {
    foreignKey: 'lab_tarrif_id',
    as: 'lab_tarrif'
  });
  LabTestTemplate.belongsTo(models.Department, {
    foreignKey: 'department_id',
    as: 'department'
  });
};

module.exports = LabTestTemplate;
