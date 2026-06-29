// models/QrCode.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Staff = require("./staff");
const Institution = require("./institution");

const QrCode = sequelize.define("QrCode", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  qr_code: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  staff_id:{
    type:DataTypes.UUID,
    allowNull:true,
    unique:true,
    references:{
      model:Staff,
      key:'id'
    }
  },
  status: {
    type: DataTypes.ENUM("ACTIVE", "DISABLED"),
    defaultValue: "ACTIVE",
  },
  institution_id:{
    type:DataTypes.UUID,
    allowNull:true,
    unique:true,
    references:{
      model:Institution,
      key:'id'
    },
  
  }
});

// malaria

module.exports = QrCode;
