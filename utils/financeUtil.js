// utils/financeUtil.js
const { Income, Expense } = require("../models");  // use your actual model paths
const { Op } = require("sequelize");

class FinanceUtil {
  // Add money to income (e.g. from a service bill or other source)
  static async addIncome({ amount, source, departmentId, createdBy }) {
    if (!amount || amount <= 0) {
      throw new Error("Invalid income amount");
    }

    const income = await Income.create({
      amount,
      source, // e.g. "Consultation", "Pharmacy", etc.
      department_id: departmentId,
      created_by: createdBy,
    });

    return income;
  }

  // Deduct money = record expense
  static async addExpense({ amount, description, departmentId, createdBy }) {
    if (!amount || amount <= 0) {
      throw new Error("Invalid expense amount");
    }

    const expense = await Expense.create({
      amount,
      description, // e.g. "Utility Bills", "Staff Salary"
      department_id: departmentId,
      created_by: createdBy,
    });

    return expense;
  }

  // Calculate hospital financial summary
  static async getProfitAndLoss({ startDate, endDate }) {
    const whereClause = {};
    if (startDate && endDate) {
      whereClause.createdAt = { [Op.between]: [startDate, endDate] };
    }

    const totalIncome = await Income.sum("amount", { where: whereClause });
    const totalExpense = await Expense.sum("amount", { where: whereClause });

    const profitOrLoss = (totalIncome || 0) - (totalExpense || 0);

    return {
      totalIncome: totalIncome || 0,
      totalExpense: totalExpense || 0,
      profitOrLoss,
      status: profitOrLoss >= 0 ? "Profit" : "Loss",
    };
  }
}

module.exports = FinanceUtil;
