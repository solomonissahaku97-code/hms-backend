const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InstitutionLabReferenceRange = sequelize.define('InstitutionLabReferenceRange', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  institution_id: { type: DataTypes.UUID, allowNull: false },
  template_id: { type: DataTypes.UUID, allowNull: true },
  test_name: { type: DataTypes.STRING, allowNull: false },
  gender: { type: DataTypes.STRING, allowNull: true, defaultValue: 'All' },
  age_min: { type: DataTypes.FLOAT, allowNull: true },
  age_max: { type: DataTypes.FLOAT, allowNull: true },
  min_value: { type: DataTypes.FLOAT, allowNull: true },
  max_value: { type: DataTypes.FLOAT, allowNull: true },
  reference_range: { type: DataTypes.STRING, allowNull: false },
  unit: { type: DataTypes.STRING, allowNull: true },
  category: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.UUID, allowNull: true },
}, {
  sequelize,
  modelName: 'InstitutionLabReferenceRange',
  tableName: 'institution_lab_reference_ranges',
  timestamps: true,
});

InstitutionLabReferenceRange.associate = (models) => {
  InstitutionLabReferenceRange.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
  InstitutionLabReferenceRange.belongsTo(models.LabTestTemplate, { foreignKey: 'template_id', as: 'template' });
};

module.exports = InstitutionLabReferenceRange;
