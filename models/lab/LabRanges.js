const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const LabTestTemplate = require('./LabTestTemplate');

const LabRanges = sequelize.define('LabRanges', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  template_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Optional link to LabTestTemplate for structured abnormal detection'
  },
  test_name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Display name of the test/parameter, e.g. Hemoglobin'
  },
  reference_range: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Human-readable range, e.g. 3.5 - 5.5'
  },
  min_value: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Numeric lower bound for abnormal detection'
  },
  max_value: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Numeric upper bound for abnormal detection'
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  notes: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'lab_ranges',
  timestamps: true
});

LabRanges.associate = (models) => {
    LabRanges.belongsTo(models.LabTestTemplate, {
        foreignKey: 'template_id',
        as: 'template'
    });
};

module.exports = LabRanges;
