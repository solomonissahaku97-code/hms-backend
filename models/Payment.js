const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust to your sequelize instance

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
        type: DataTypes.INTEGER,
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
}, {
    timestamps: true,
    tableName: 'payments',
});

module.exports = Payment;
