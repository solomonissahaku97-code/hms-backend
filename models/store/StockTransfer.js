const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const StockTransfer = sequelize.define('StockTransfer', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    transfer_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    from_department_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    to_department_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    transferred_by: {
        type: DataTypes.UUID,
        allowNull: false
    },
    received_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    transfer_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    receive_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'in_transit', 'completed', 'cancelled'),
        defaultValue: 'pending'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'stock_transfers',
    timestamps: true,
});

module.exports = StockTransfer;