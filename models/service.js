const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const Service = sequelize.define('Service', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    cost: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    is_free: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    }
}, {
    sequelize,
    timestamps: true,
    modelName: 'Service',
    tableName: 'services'
});

// association
Service.associate = (models) => {
    Service.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' }); 
    // If ServiceBill should be associated, uncomment and adjust the following line:
    // Service.hasMany(models.ServiceBill, { foreignKey: 'service_id', as: 'serviceBills' });
    // Removed hasMany ServiceBill - service_id in ServiceBill is polymorphic (references different tables based on service_type)
};

module.exports = Service;
