const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const SmsSubscriptions = sequelize.define('sms_subscriptions', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution, // Ensure your institution model is correctly named
            key: 'id',
        },
    },
    total_sms: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10, // Each institution starts with 10 SMS
    },
    sms_used: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0, // SMS usage starts at 0
    },
    
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'sms_subscriptions',
    timestamps: false,
});

SmsSubscriptions.associations = (models) => {
    SmsSubscriptions.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'sms_subscriptions' })
}

module.exports = SmsSubscriptions;
