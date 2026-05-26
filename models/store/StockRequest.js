const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const StockRequest = sequelize.define('StockRequest', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    request_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    requested_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium'
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'partially_approved', 'rejected', 'issued', 'cancelled'),
        defaultValue: 'pending'
    },
    request_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    required_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    purpose: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    approved_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    approved_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'stock_requests',
    timestamps: true,
});

// Define associations
StockRequest.associate = (models) => {
    StockRequest.hasMany(models.StockRequestItem, { foreignKey: 'stock_request_id', as: 'items' });
    StockRequest.belongsTo(models.Item, { foreignKey: 'item_id', as: 'item' });
};

module.exports = StockRequest;
