const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const StockRequestItem = sequelize.define('StockRequestItem', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    stock_request_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    quantity_requested: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    quantity_approved: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    quantity_issued: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    total_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'issued'),
        defaultValue: 'pending'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'stock_request_items',
    timestamps: true,
});

// Define associations
StockRequestItem.associate = (models) => {
    StockRequestItem.belongsTo(models.StockRequest, { foreignKey: 'stock_request_id', as: 'request' });
    StockRequestItem.belongsTo(models.Item, { foreignKey: 'item_id', as: 'item' });
};

module.exports = StockRequestItem;
