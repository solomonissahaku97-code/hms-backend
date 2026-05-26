const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WaitList = sequelize.define('waitlist', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      is: {
        args: /^\+\d{10,15}$/, // e.g. +233542012345, +12345678901
        msg: 'Phone number must be in international format starting with + followed by 10–15 digits',
      }
    }
  }
}, {
  timestamps: true,
  tableName: 'waitlist'
});

module.exports = WaitList;
