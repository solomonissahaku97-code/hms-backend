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
    unique: true, // if you still want code to be unique
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

// Define associations if necessary
module.exports = Medicine;
