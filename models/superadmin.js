const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SuperAdmin = sequelize.define('superadmin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  role_manager: {
    type: DataTypes.STRING(10),
    defaultValue: 'superadmin',
    allowNull: false,
    validate: {
      is: /^superadmin$/ // Only allows the string "superadmin"
    }
  }
}, {
  sequelize,
  tableName: 'superadmin',
  timestamps: true
});

module.exports = SuperAdmin;


