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
  lab_tarrif_id: {
    type: DataTypes.UUID,
    references: {
      model: LabInvestigation,
      key: 'id'
    }
  },

  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  description: DataTypes.TEXT,
  createdBy: {
    type: DataTypes.UUID, // Staff ID who created this
    allowNull: true,
    references: {
      model: Staff,
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
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
  console.log(models)
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
};




module.exports = LabTestTemplate;

