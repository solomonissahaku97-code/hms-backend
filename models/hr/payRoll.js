const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Payroll = sequelize.define('Payroll', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    payPeriod: {
        type: DataTypes.ENUM(
            'Monthly',
            'Bi-Weekly',
            'Weekly'
        ),
        allowNull: false,
        defaultValue: 'Monthly'
    },
    baseSalary: {
        type: DataTypes.DECIMAL(12, 2), // Supports up to 999,999,999.99
        allowNull: false
    },
    payDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM(
            'Draft',
            'Processing',
            'Approved',
            'Paid',
            'Cancelled'
        ),
        defaultValue: 'Draft'
    },
    paymentMethod: {
        type: DataTypes.ENUM(
            'Bank Transfer',
            'Check',
            'Cash'
        ),
        allowNull: false
    },
    bankAccountNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bankName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    taxIdentificationNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Earnings
    overtimePay: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0
    },
    bonus: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0
    },
    allowances: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
        comment: 'Sum of all allowances (housing, transport, etc.)'
    },
    // Deductions
    taxDeduction: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0
    },
    socialSecurityDeduction: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0
    },
    healthInsuranceDeduction: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0
    },
    pensionDeduction: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0
    },
    otherDeductions: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
        comment: 'Union dues, advances, etc.'
    },
    // Calculated fields
    grossPay: {
        type: DataTypes.DECIMAL(12, 2),
        comment: 'baseSalary + overtimePay + bonus + allowances'
    },
    totalDeductions: {
        type: DataTypes.DECIMAL(12, 2),
        comment: 'Sum of all deductions'
    },
    netPay: {
        type: DataTypes.DECIMAL(12, 2),
        comment: 'grossPay - totalDeductions'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    approvedById: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    payslipUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Generated payslip PDF storage URL'
    }
}, {
    timestamps: true,
    paranoid: true,
    hooks: {
        beforeSave: (payroll) => {
            // Auto-calculate financial fields
            payroll.grossPay = (
                parseFloat(payroll.baseSalary || 0) +
                parseFloat(payroll.overtimePay || 0) +
                parseFloat(payroll.bonus || 0) +
                parseFloat(payroll.allowances || 0)
            ).toFixed(2);

            payroll.totalDeductions = (
                parseFloat(payroll.taxDeduction || 0) +
                parseFloat(payroll.socialSecurityDeduction || 0) +
                parseFloat(payroll.healthInsuranceDeduction || 0) +
                parseFloat(payroll.pensionDeduction || 0) +
                parseFloat(payroll.otherDeductions || 0)
            ).toFixed(2);

            payroll.netPay = (payroll.grossPay - payroll.totalDeductions).toFixed(2);
        }
    },
    indexes: [
        { fields: ['staff_id'] },
        { fields: ['payDate'] },
        { fields: ['status'] }
    ]
});

Payroll.associate = (models)=>{
    Payroll.belongsTo(models.Staff,{ foreignKey:'staff_id',as:'payroll' })
}


module.exports = Payroll

