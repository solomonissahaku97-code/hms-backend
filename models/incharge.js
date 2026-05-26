const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Staff = require('./staff');
const Institution = require('./institution');
const Department = require('./department');


const Incharges = sequelize.define('incharge_table', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    staff_id: {
        type: DataTypes.UUID,
        references: {
            model: Staff,
            key: 'id'
        },
        allowNull: false
    },

    institution_id: {
        type: DataTypes.UUID,
        references: {
            model: Institution,
            key: 'id'
        },
        allowNull: false,
    },
    department_id: {
        type: DataTypes.UUID,
        references: {
            model: Department,
            key: 'id'
        }
    }
})

Incharges.associate = (models) => {
    Incharges.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
    Incharges.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    Incharges.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
};



module.exports = Incharges