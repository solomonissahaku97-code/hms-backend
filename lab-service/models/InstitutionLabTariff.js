const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InstitutionLabTariff = sequelize.define('InstitutionLabTariff', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  institution_id: { type: DataTypes.UUID, allowNull: false },
  lab_investigation_id: { type: DataTypes.UUID, allowNull: false },
  tariff_ghc: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  market_price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  modelName: 'InstitutionLabTariff',
  tableName: 'institution_lab_tariffs',
  timestamps: true,
  indexes: [{ unique: true, fields: ['institution_id', 'lab_investigation_id'] }],
});

InstitutionLabTariff.associate = (models) => {
  InstitutionLabTariff.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
  InstitutionLabTariff.belongsTo(models.LabInvestigation, { foreignKey: 'lab_investigation_id', as: 'labInvestigation' });
};

module.exports = InstitutionLabTariff;
