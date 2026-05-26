const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Department = require('./department');
const Staff = require('./staff');

const RotationStaff = sequelize.define('RotationStaff', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
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
    department_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Department,
            key: 'id'
        }
    },
    day: {
        type: DataTypes.ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
        allowNull: false,
    },
    shift: {
        type: DataTypes.ENUM('morning', 'afternoon', 'evening', 'night', 'off'),
        allowNull: false,
    },
    start_time: {
        type: DataTypes.TIME, // Start time for the shift
        allowNull: true,
    },
    end_time: {
        type: DataTypes.TIME, // End time for the shift
        allowNull: true,
    },
    notes: {
        type: DataTypes.STRING, // Optional notes for the shift (e.g., "Optional duty")
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'RotationStaff',
    timestamps: false,
    tableName: 'rotation_staff'
});

RotationStaff.associate = (models) => {
    RotationStaff.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'rotation' });
    RotationStaff.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    RotationStaff.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });

};

module.exports = RotationStaff;
