const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const Transactions = sequelize.define('Transaction', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
    },
    institution_id: {
        type: DataTypes.UUID,
        references: {
            model: Institution,
            key: 'id',
        },
        allowNull: false,
    },
    transaction_type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['charge', 'payment']],  // Example values for transaction types
        },
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    currency: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    transaction_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    status: {
        allowNull: false,
        type: DataTypes.ENUM('pending', 'success', 'failed'),
    },
    paystack_reference: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
    },
}, {
    sequelize,
    modelName: 'Transaction',
    tableName: 'transactions',  // Ensuring pluralization follows conventions
    timestamps: true,
});

module.exports = Transactions;
