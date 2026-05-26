// models/Income.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Income = sequelize.define("Income", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  source: {
    type: DataTypes.ENUM("patient", "insurance", "nhia", "other"),
    allowNull: false,
  },

  description: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: "e.g., OPD consultation fee, lab test, NHIA reimbursement",
  },

  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },

  receivedDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },

  receivedBy: {
    type: DataTypes.UUID,
    references: { model: "staffs", key: "id" },
  }
}, {
  tableName: "incomes",
  timestamps: true,
  indexes: [{ fields: ["source"] }]
});

module.exports = Income;
