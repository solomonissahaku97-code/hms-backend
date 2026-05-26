const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const StockTransferItem = sequelize.define('StockTransferItem', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    quantity_transferred: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    quantity_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    batch_number: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    condition: {
        type: DataTypes.ENUM('good', 'damaged'),
        defaultValue: 'good'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'stock_transfer_items',
    timestamps: true,
});

module.exports = StockTransferItem;