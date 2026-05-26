const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const StockAlert = sequelize.define('StockAlert', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'items',
            key: 'id'
        }
    },
    batch_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'item_batches',
            key: 'id'
        }
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    alert_type: {
        type: DataTypes.ENUM('low_stock', 'expiry_soon', 'out_of_stock', 'over_stock'),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false
    },
    current_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    threshold_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    expiry_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_resolved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    resolved_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    resolved_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    resolution_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    notified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'stock_alerts',
    timestamps: true,
});

// Define associations
StockAlert.associate = (models) => {
    StockAlert.belongsTo(models.Item, { foreignKey: 'item_id', as: 'item' });
    StockAlert.belongsTo(models.ItemBatch, { foreignKey: 'batch_id', as: 'batch' });
};

module.exports = StockAlert;
