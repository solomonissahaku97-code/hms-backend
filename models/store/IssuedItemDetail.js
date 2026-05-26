const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const IssuedItemDetail = sequelize.define('IssuedItemDetail', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    quantity_issued: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    quantity_returned: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    total_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    batch_number: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    expiry_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    return_condition: {
        type: DataTypes.ENUM('good', 'damaged', 'expired'),
        allowNull: true
    },
    return_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'issued_item_details',
    timestamps: true,
});

module.exports = IssuedItemDetail;