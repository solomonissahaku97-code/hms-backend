// models/QrCode.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const QrCode = sequelize.define("QrCode", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  isUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = QrCode;
