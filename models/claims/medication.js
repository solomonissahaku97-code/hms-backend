const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Medicine = sequelize.define('Medicine', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING,
    unique: true,
  },
  generic_name: DataTypes.STRING,
  unit_of_pricing: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'per unit',
  },
  market_price: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  nhia_price:{
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  is_nhia_covered:{
    type:DataTypes.BOOLEAN,
    defaultValue:true,
  },
  level_of_prescribing: DataTypes.STRING,
}, {
  tableName: 'medicines',
  timestamps: false
});

Medicine.associate = (models) => {
  Medicine.hasMany(models.institutionPharmacyPrice, {
    foreignKey: 'medicine_id',
    as: 'institutionPharmacyPrices'
  });
};

module.exports = Medicine;
