const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
    },
    transactionId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'GHS',
    },
    paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    payment_method: {
        type: DataTypes.ENUM('cash', 'credit_card', 'insurance', 'bank_transfer', 'mobile_money', 'other'),
        allowNull: true,
    },
    payment_type: {
        type: DataTypes.ENUM('full', 'partial', 'nhis'),
        allowNull: true,
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    invoice_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'invoices', key: 'id' },
    },
    service_bill_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'service_bills', key: 'id' },
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'patients', key: 'id' },
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'staffs', key: 'id' },
    },
}, {
    timestamps: true,
    tableName: 'payments',
});

Payment.associate = (models) => {
    Payment.belongsTo(models.Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
    Payment.belongsTo(models.ServiceBill, { foreignKey: 'service_bill_id', as: 'serviceBill' });
    Payment.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    Payment.belongsTo(models.Staff, { foreignKey: 'created_by', as: 'creator' });
};

module.exports = Payment;
