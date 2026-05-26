const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Department = require('./department');

const DepartmentCreationBilling = sequelize.define('DepartmentCreationBilling', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    institution_id: {
        type: DataTypes.UUID, // Add the missing data type
        references: {
            model: Institution,
            key: 'id',
        },
        allowNull: false, // Ensure foreign key is not null if required
    },
    department_Id: {
        type: DataTypes.UUID, // Add the missing data type
        references: {
            model: Department,
            key: 'id',
        },
        allowNull: false,
    },
    amount_to_pay: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',  // Example status values: pending, completed
    },
}, {
    sequelize,
    tableName: 'department_creation_billing',
    timestamps: false,
});

DepartmentCreationBilling.associations = (models) => {
    DepartmentCreationBilling.belongsTo(models.Department, { foreignKey: 'department_Id', as: 'department_billing' })
    DepartmentCreationBilling.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' })
}

module.exports = DepartmentCreationBilling;
