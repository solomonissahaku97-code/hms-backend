const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const GDRGCode = sequelize.define('GDRGCode', {
  id: {  // Add this primary key
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  condition: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  market_price: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  nhia_price: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  coverage_percentage: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  is_nhia_covered: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
}, {
  timestamps: true,
  tableName: 'gdrg_codes',
  underscored: true

});

module.exports = GDRGCode;
