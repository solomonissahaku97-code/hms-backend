const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const CaseCartItem = sequelize.define('CaseCartItem', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    case_cart_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'case_carts',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    category: {
        type: DataTypes.ENUM(
            'implant',
            'instrument',
            'medication',
            'supplies',
            'equipment',
            'specimen',
            'other'
        ),
        allowNull: true,
        defaultValue: 'other',
    },
    status: {
        type: DataTypes.ENUM(
            'pending',
            'ready',
            'unavailable',
            'used',
            'returned'
        ),
        allowNull: true,
        defaultValue: 'pending'
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
    },
    notes: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Additional notes for this item'
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    prepared_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        },
    },
    prepared_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    item_type: {
        type: DataTypes.ENUM('inventory', 'custom'),
        allowNull: true,
        defaultValue: 'custom',
    },
    inventory_item_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'items',
            key: 'id'
        },
    },
    batch_number: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    expiry_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    }
}, {
    tableName: 'case_cart_items',
    timestamps: true,
    underscored: true
});

// Define associations
CaseCartItem.associate = (models) => {
    CaseCartItem.belongsTo(models.CaseCart, {
        foreignKey: 'case_cart_id',
        as: 'caseCart'
    });
    CaseCartItem.belongsTo(models.Staff, {
        foreignKey: 'prepared_by',
        as: 'preparer'
    });
    CaseCartItem.belongsTo(models.Item, {
        foreignKey: 'inventory_item_id',
        as: 'inventoryItem'
    });
};

module.exports = CaseCartItem;

