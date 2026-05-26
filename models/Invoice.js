const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'visits', key: 'id' }
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'institutions', key: 'id' }
    },
    invoice_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    invoice_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    due_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    },
    subtotal: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    tax_amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    discount_amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    total_amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    amount_paid: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    balance_due: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
        set(val) {
            this.setDataValue('balance_due', Math.round((this.total_amount - this.amount_paid) * 100) / 100);
        }
    },
    status: {
        type: DataTypes.ENUM('draft', 'unpaid', 'partially_paid', 'paid', 'cancelled', 'refunded'),
        defaultValue: 'draft'
    },
    payment_method: {
        type: DataTypes.ENUM('cash', 'credit_card', 'insurance', 'bank_transfer', 'mobile_money', 'other'),
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional invoice metadata like insurance details, billing codes, etc.'
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'staffs', key: 'id' }
    }
}, {
    tableName: 'invoices',
    timestamps: true,
    underscored: true,

});

// Associations
Invoice.associate = (models) => {
    Invoice.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
    Invoice.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    Invoice.belongsTo(models.Staff, { foreignKey: 'created_by', as: 'creator' });
    Invoice.hasMany(models.ServiceBill, {
        foreignKey: 'invoice_id',
        as: 'service_bills',
    });

};

module.exports = Invoice;