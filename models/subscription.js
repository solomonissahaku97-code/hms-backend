const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subscription = sequelize.define('subscription', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    name: {
        type: DataTypes.STRING,

        allowNull: false,
        validate: {
            notEmpty: true,
        },
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
            isFloat: true,
            min: 0,
        },
    },
    duration: {
        type: DataTypes.INTEGER, // Duration in days
        allowNull: false,
        validate: {
            isInt: true,
            min: 1,
        },
    },
    features: {
        type: DataTypes.JSON, // Stores features as an array of strings or key-value pairs
        allowNull: false,
        defaultValue: [],
    },
    status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true, // Active by default
    },
}, {
    tableName: 'subscriptions',
    timestamps: true, // Adds createdAt and updatedAt fields
});

Subscription.associations = (models) => {
    Subscription.hasMany(models.Institution, { foreignKey: 'institutionId', as: 'institution' });

}
module.exports = Subscription;
