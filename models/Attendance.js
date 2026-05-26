// models/Attendance.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Staff = require("./staff");

const Attendance = sequelize.define("Attendance", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  staffId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Staff,
      key: 'id',
    },
  },
  signInTime: {
    type: DataTypes.DATE,
    allowNull: true, // Null if not signed in yet
  },
  signOutTime: {
    type: DataTypes.DATE,
    allowNull: true, // Null if not signed out yet
  },
  date: { // Store date separately for easy querying
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

Attendance.associate = (models) => {
  Attendance.belongsTo(models.Staff, { foreignKey: 'staffId', as: 'staff' });
};


module.exports = Attendance;  