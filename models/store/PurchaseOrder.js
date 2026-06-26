const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    po_number: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false
    },
    supplier_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    order_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    expected_delivery_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    actual_delivery_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('draft', 'sent', 'confirmed', 'received', 'cancelled', 'partially_received'),
        defaultValue: 'draft'
    },
    total_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    shipping_charges: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    final_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    prepared_by: {
        type: DataTypes.UUID,
        allowNull: false
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
    tableName: 'purchase_orders',
    timestamps: true,
});

// Associations
PurchaseOrder.associate = (models) => {
    PurchaseOrder.belongsTo(models.Supplier, {
        foreignKey: 'supplier_id',
        as: 'supplier',
    });
};

module.exports = PurchaseOrder;

