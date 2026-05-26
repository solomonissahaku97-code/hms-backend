const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const Department = sequelize.define('Department', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: false
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    department_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    departmentType: {
        type: DataTypes.ENUM(
            'Ward',
            'Labour Ward',
            'Antenatal Care (ANC)',
            'Postpartum Ward',
            'Neonatal Unit',
            'Consultation',
            'Pharmacy',
            'Lab',
            'Records',
            'OPD',
            'Accounts',
            'HR',
            'Store',
            'Surgery',
            'Claims',
            'Information Manager',
            'Clerk'
        ),
        allowNull: false,
    },

}, {
    sequelize,
    modelName: 'Department',
    timestamps: true,
    tableName: 'departments',
    hooks: {
        beforeCreate: (department) => {
            department.department_number = '#' + Math.floor(10000000 + Math.random() * 90000000).toString();
        }
    }
});

Department.associate = (models) => {
    Department.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    Department.hasMany(models.Staff, { foreignKey: 'department_id', as: 'staff' });
    Department.hasMany(models.Visit, { foreignKey: 'department_id', as: 'patients' });
    Department.belongsToMany(models.AccessControl, { through: 'DepartmentAccessControls' });
    Department.hasMany(models.InventoryRecord, { foreignKey: 'department_id', as: 'records' });
    Department.hasMany(models.Bed, { foreignKey: 'department_id', as: 'bed' });
    Department.hasMany(models.Prescription, {
        foreignKey: 'department_id',
        as: 'prescriptions'
    });
    Department.associate = (models) => {
        Department.belongsToMany(models.Staff, {
            through: models.StaffDepartment,
            foreignKey: 'department_id',
            otherKey: 'staff_id',
            as: 'staffs'
        });
    };


};

module.exports = Department;
