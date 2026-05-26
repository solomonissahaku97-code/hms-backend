const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ItemBatch = sequelize.define('ItemBatch', {
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
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    batch_number: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    current_quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    selling_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    expiry_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    manufacture_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    supplier_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    received_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    status: {
        type: DataTypes.ENUM('active', 'expired', 'depleted', 'recalled'),
        defaultValue: 'active'
    },
    location: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'item_batches',
    timestamps: true,
});

// Define associations
ItemBatch.associate = (models) => {
    ItemBatch.belongsTo(models.Item, { foreignKey: 'item_id', as: 'item' });
    ItemBatch.belongsTo(models.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
};

module.exports = ItemBatch;
