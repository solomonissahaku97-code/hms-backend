const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ExpiredItem = sequelize.define('ExpiredItem', {
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
    batch_number: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    total_loss: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    expiry_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    disposed_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    disposal_method: {
        type: DataTypes.ENUM('destroyed', 'returned_to_supplier', 'donated', 'recycled'),
        allowNull: false
    },
    disposed_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    approved_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'expired_items',
    timestamps: true,
});

// Define associations
ExpiredItem.associate = (models) => {
    ExpiredItem.belongsTo(models.Item, { foreignKey: 'item_id', as: 'item' });
    ExpiredItem.belongsTo(models.ItemBatch, { foreignKey: 'batch_id', as: 'batch' });
};

module.exports = ExpiredItem;
