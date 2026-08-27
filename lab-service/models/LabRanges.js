const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LabRanges = sequelize.define('LabRanges', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  template_id: { type: DataTypes.UUID, allowNull: true },
  test_name: { type: DataTypes.STRING, allowNull: false },
  reference_range: { type: DataTypes.STRING, allowNull: false },
  min_value: { type: DataTypes.FLOAT, allowNull: true },
  max_value: { type: DataTypes.FLOAT, allowNull: true },
  unit: { type: DataTypes.STRING, allowNull: true },
  category: { type: DataTypes.STRING, allowNull: false },
  notes: { type: DataTypes.STRING, allowNull: true },
}, {
  sequelize,
  modelName: 'LabRanges',
  tableName: 'lab_ranges',
  timestamps: true,
});

LabRanges.associate = (models) => {
  LabRanges.belongsTo(models.LabTestTemplate, { foreignKey: 'template_id', as: 'template' });
};

module.exports = LabRanges;
