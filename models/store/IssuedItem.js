const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const IssuedItem = sequelize.define('IssuedItem', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    batch_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    issue_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    issued_to: {
        type: DataTypes.UUID, // Staff ID
        allowNull: true
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    issued_by: {
        type: DataTypes.UUID, // Store staff ID
        allowNull: true
    },
    issue_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    purpose: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('issued', 'returned', 'partially_returned'),
        defaultValue: 'issued'
    },
    return_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'issued_items',
    timestamps: true,
});

// Define associations
IssuedItem.associate = (models) => {
    IssuedItem.belongsTo(models.Item, { foreignKey: 'item_id', as: 'item' });
    IssuedItem.belongsTo(models.ItemBatch, { foreignKey: 'batch_id', as: 'batch' });
};

module.exports = IssuedItem;
