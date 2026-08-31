const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * InstitutionPharmacyPrice — Per-institution medicine pricing overrides.
 *
 * Each institution can set its own market_price and nhia_price for any medicine.
 * The UNIQUE constraint on (institution_id, medicine_id) ensures one price per
 * medicine per institution.
 *
 * When dispensing, the system resolves the price:
 *   1. Check institution_pharmacy_prices for an override
 *   2. Fall back to DrugBatch.selling_price / nhia_price
 *   3. Fall back to 0
 */
const InstitutionPharmacyPrice = sequelize.define('InstitutionPharmacyPrice', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Institution that this price applies to',
  },
  medicine_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Medication this price is for',
  },
  market_price: {
    type: DataTypes.DOUBLE,
    allowNull: true,
    defaultValue: 0,
    comment: 'Cash/self-pay price',
  },
  nhia_price: {
    type: DataTypes.DOUBLE,
    allowNull: true,
    defaultValue: 0,
    comment: 'NHIA-covered price',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  sequelize,
  modelName: 'InstitutionPharmacyPrice',
  tableName: 'institution_pharmacy_prices',
  timestamps: true,
  indexes: [
    { fields: ['institution_id', 'medicine_id'], unique: true },
    { fields: ['institution_id'] },
    { fields: ['medicine_id'] },
  ],
});

InstitutionPharmacyPrice.associate = (models) => {
  InstitutionPharmacyPrice.belongsTo(models.Medication, { foreignKey: 'medicine_id', as: 'medicine' });
};

module.exports = InstitutionPharmacyPrice;
