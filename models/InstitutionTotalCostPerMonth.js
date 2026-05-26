const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const InstitutionTotalCost = sequelize.define('InstitutionTotalCost', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID, // Add the missing data type
        references: {
            model: Institution,
            key: 'id'
        },
        allowNull: false, // Ensure this field is not null if necessary
    },
    amount_due: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    }
}, {
    sequelize,
    tableName: 'amountDue',
    timestamps: false
});

module.exports = InstitutionTotalCost;
