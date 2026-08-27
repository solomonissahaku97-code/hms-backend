const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LabTestField = sequelize.define('LabTestField', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  label: { type: DataTypes.STRING, allowNull: false },
  fieldType: {
    type: DataTypes.ENUM('text', 'number', 'select', 'checkbox', 'radio', 'date', 'textarea', 'file'),
    allowNull: false,
  },
  options: { type: DataTypes.JSON, defaultValue: [] },
  required: { type: DataTypes.BOOLEAN, defaultValue: false },
  order: { type: DataTypes.INTEGER, defaultValue: 0 },
  templateId: { type: DataTypes.UUID, allowNull: false },
}, {
  sequelize,
  modelName: 'LabTestField',
  tableName: 'lab_test_fields',
  timestamps: true,
});

LabTestField.associate = (models) => {
  LabTestField.belongsTo(models.LabTestTemplate, { foreignKey: 'templateId', as: 'template' });
};

module.exports = LabTestField;
