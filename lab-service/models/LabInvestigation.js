const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LabInvestigation = sequelize.define('LabInvestigation', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  test_description: { type: DataTypes.STRING, allowNull: false },
  g_drg_code: { type: DataTypes.STRING, allowNull: false, unique: true },
  tariff_ghc: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  market_price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  department_id: { type: DataTypes.UUID, allowNull: true },
}, {
  sequelize,
  modelName: 'LabInvestigation',
  tableName: 'lab_investigations',
  timestamps: true,
});

module.exports = LabInvestigation;
