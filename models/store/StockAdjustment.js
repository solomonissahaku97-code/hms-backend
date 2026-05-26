const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const StockAdjustment = sequelize.define('StockAdjustment', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    batch_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    adjustment_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    adjustment_type: {
        type: DataTypes.ENUM('increase', 'decrease'),
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    adjusted_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    adjusted_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'stock_adjustments',
    timestamps: true,
});

// Define associations
StockAdjustment.associate = (models) => {
    StockAdjustment.belongsTo(models.Item, { foreignKey: 'item_id', as: 'item' });
    StockAdjustment.belongsTo(models.ItemBatch, { foreignKey: 'batch_id', as: 'batch' });
};

module.exports = StockAdjustment;
