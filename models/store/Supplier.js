const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Supplier = sequelize.define('Supplier', {
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
        allowNull: false
    },
    contact_person: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    phone: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    tax_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    payment_terms: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    rating: {
        type: DataTypes.INTEGER,
        validate: { min: 1, max: 5 },
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'suppliers',
    timestamps: true,
});

// Define associations
Supplier.associate = (models) => {
    Supplier.hasMany(models.Item, { foreignKey: 'supplier_id', as: 'items' });
    Supplier.hasMany(models.ItemBatch, { foreignKey: 'supplier_id', as: 'batches' });
};

module.exports = Supplier;
