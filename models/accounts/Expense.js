// models/Expense.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const Expense = sequelize.define("Expense", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  description: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: "What the expense is for (e.g., drugs purchase, electricity bill, equipment repair)",
  },

  category: {
    type: DataTypes.ENUM(
      "procurement",   // drugs, equipment, consumables
      "utilities",     // water, electricity, internet
      "staff",         // allowances, overtime, training
      "maintenance",   // repairs, servicing
      "miscellaneous"
    ),
    allowNull: false,
  },

  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },

  vendor: {
    type: DataTypes.STRING,
    comment: "Who was paid (supplier, staff, utility company, etc.)",
  },

  paymentDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },

  paidBy: {
    type: DataTypes.UUID,
    references: { model: "staffs", key: "id" }, // who in accounts approved
  },

  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
}, {
  tableName: "expenses",
  timestamps: true,
  indexes: [{ fields: ["category"] }]
});

module.exports = Expense;
