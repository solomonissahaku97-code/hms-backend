const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Admin = require('./admin');
const PaymentGateWay = require('./PaymentGateWays');

const PaymentMethod = sequelize.define('PaymentMethod', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        references: {
            model: Institution,
            key: 'id'
        },
        allowNull: false,
    },
    admin_id: {
        type: DataTypes.UUID,
        references: {
            model: Admin,
            key: 'id'
        },
        allowNull: true,
    },
    method_name: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: PaymentGateWay,
            key: 'id'
        }
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Status of the payment method, active or inactive'
    },
}, {
    tableName: 'payment_methods',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
PaymentMethod.associate = (models) => {
    PaymentMethod.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'payment_method' })
    PaymentMethod.belongsTo(models.PaymentGateWay, { foreignKey: 'id', as: 'payment_gateway' })
}

module.exports = PaymentMethod;
