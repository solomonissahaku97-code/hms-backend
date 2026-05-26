const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const LabRanges = sequelize.define('LabRanges', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  test_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  reference_range: {
    type: DataTypes.STRING,
    allowNull: false
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

module.exports = LabRanges;
