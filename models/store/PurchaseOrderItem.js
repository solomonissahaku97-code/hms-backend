const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const PurchaseOrderItem = sequelize.define('PurchaseOrderItem', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    quantity_ordered: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    quantity_received: {
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
    received_condition: {
        type: DataTypes.ENUM('good', 'damaged', 'short_shipment'),
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'purchase_order_items',
    timestamps: true,
});

module.exports = PurchaseOrderItem;