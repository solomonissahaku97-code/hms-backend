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
        allowNull: false
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false
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
        allowNull: true
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    token: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Shareable token for public invoice viewing'
    },
    sms_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    sms_sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    paid_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    paid_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    viewed_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    viewed_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'invoices',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['token'], unique: true }
    ],
    hooks: {
        beforeSave: (invoice) => {
            // Always recalculate balance from source-of-truth amounts
            invoice.balance_due = Math.round((invoice.total_amount - invoice.amount_paid) * 100) / 100;

            // Auto-derive status so it can never drift out of sync with amounts.
            // Skip if already cancelled/refunded — those are manual state transitions
            // that should not be overridden by amount arithmetic.
            const skipStatus = ['cancelled', 'refunded'];
            if (!skipStatus.includes(invoice.status)) {
                if (invoice.balance_due <= 0 && parseFloat(invoice.amount_paid) > 0) {
                    invoice.status = 'paid';
                } else if (parseFloat(invoice.amount_paid) > 0 && invoice.balance_due > 0) {
                    invoice.status = 'partially_paid';
                } else {
                    invoice.status = 'unpaid';
                }
            }
        }
    }
});

// Associations
Invoice.associate = (models) => {
    Invoice.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
    Invoice.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    Invoice.belongsTo(models.Staff, { foreignKey: 'created_by', as: 'creator' });
    // paid_by is a plain UUID — no FK constraint so both staff and admin IDs are accepted
    // Invoice.belongsTo(models.Staff, { foreignKey: 'paid_by', as: 'paidBy' });
    Invoice.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    Invoice.hasMany(models.ServiceBill, {
        foreignKey: 'invoice_id',
        as: 'service_bills',
    });

};

module.exports = Invoice;