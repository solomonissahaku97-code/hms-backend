const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const InstitutionPaymentHistory = sequelize.define('InstitutionPaymentHistory', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        references: {
            model: Institution,
            key: 'id',
        },
        allowNull: false,
    },

    amount_paid: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },

    payment_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    payment_method: {
        type: DataTypes.STRING,
        allowNull: false,  // e.g., 'credit', 'cash', etc.
    },
}, {
    sequelize,
    modelName: 'InstitutionPaymentHistory',
    tableName: 'institution_payment_history',
    timestamps: true,
});

module.exports = InstitutionPaymentHistory;