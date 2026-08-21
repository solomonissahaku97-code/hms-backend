const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InstitutionLabReferenceRange = sequelize.define('InstitutionLabReferenceRange', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'institutions', key: 'id' },
    onDelete: 'CASCADE',
  },
  template_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'lab_test_templates', key: 'id' },
    onDelete: 'SET NULL',
    comment: 'Link to the lab test template',
  },
  test_name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Display name of the test/parameter, e.g. Hemoglobin',
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'All',
    comment: 'Male, Female, or All',
  },
  age_min: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Minimum age for this range (years)',
  },
  age_max: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Maximum age for this range (years)',
  },
  min_value: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Numeric lower bound',
  },
  max_value: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Numeric upper bound',
  },
  reference_range: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Human-readable range, e.g. 13 - 17',
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Optional description or clinical context',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'institution_lab_reference_ranges',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['template_id'] },
    { fields: ['test_name'] },
    { fields: ['institution_id', 'test_name'] },
    { fields: ['institution_id', 'template_id'] },
  ],
});

InstitutionLabReferenceRange.associate = (models) => {
  InstitutionLabReferenceRange.belongsTo(models.Institution, {
    foreignKey: 'institution_id',
    as: 'institution',
  });
  InstitutionLabReferenceRange.belongsTo(models.LabTestTemplate, {
    foreignKey: 'template_id',
    as: 'template',
  });
};

module.exports = InstitutionLabReferenceRange;
