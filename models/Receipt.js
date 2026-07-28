const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Receipt = sequelize.define('Receipt', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    receipt_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    invoice_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    amount_paid: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    payment_method: {
        type: DataTypes.STRING,
        allowNull: false
    },
    payment_reference: {
        type: DataTypes.STRING,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
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
    viewed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    viewed_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'receipts',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

Receipt.associate = (models) => {
    Receipt.belongsTo(models.Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
    Receipt.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    Receipt.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
};

module.exports = Receipt;
