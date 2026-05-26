const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Department = require('./department');
const Institution = require('./institution');

const GeneralNotification = sequelize.define('GeneralNotification', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Department,
            key: 'id'
        }

    },

    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }

    },

    message: {
        type: DataTypes.TEXT,
        allowNull: false
    }

}, {
    sequelize,
    modelName: 'GeneralNotification',
    timestamps: true,
    tableName: 'general_notifications'
});

GeneralNotification.associate = (models) => {
    GeneralNotification.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    GeneralNotification.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
};

module.exports = GeneralNotification;
