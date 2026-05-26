const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Item = sequelize.define('Item', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    category: {
        type: DataTypes.ENUM(
            'medicine',
            'medical_equipment',
            'surgical_supplies',
            'laboratory',
            'radiology',
            'consumables',
            'office_supplies',
            'cleaning_supplies'
        ),
        allowNull: false
    },
    unit_of_measure: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'pieces'
    },
    reorder_level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10
    },
    critical_level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'items',
    timestamps: true,
});

// Define associations
Item.associate = (models) => {
    Item.hasMany(models.ItemBatch, { foreignKey: 'item_id', as: 'batches' });
    Item.hasMany(models.StockAlert, { foreignKey: 'item_id', as: 'alerts' });
    Item.belongsTo(models.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
};

module.exports = Item;
