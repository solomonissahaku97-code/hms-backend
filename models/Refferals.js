const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const Referrals = sequelize.define('Referrals', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    referrerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution, // Assuming the model is named Institutions
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    referredId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution, // Assuming the model is named Institutions
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'referrals',
    timestamps: true
});

Referrals.associate = (models) => {
    Referrals.belongsTo(models.Institution, {
        foreignKey: 'referrerId',
        as: 'referrer'
    });
    Referrals.belongsTo(models.Institution, {
        foreignKey: 'referredId',
        as: 'referred'
    });

}

module.exports = Referrals;
