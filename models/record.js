const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Patient = require('./patient');
const Department = require('./department');

const Record = sequelize.define('Record', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Patient,
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
    folder_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
    },
    serial_number: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    visit_type: {
        type: DataTypes.ENUM('inpatient', 'outpatient'),
        allowNull: false,
        defaultValue: 'outpatient'
    },
    status: {
        type: DataTypes.ENUM('active', 'discharged', 'transferred', 'admitted','deceased'),
        allowNull: false,
        defaultValue: 'active'
    },
    condition_status: {
        type: DataTypes.ENUM('stable', 'critical', 'recovered'),
        allowNull: false,
        defaultValue: 'stable'
    },
    nin_number: {
        type: DataTypes.STRING(15),
        allowNull: true
    },
    nhis_number:{
        type: DataTypes.STRING(),
        allowNull: true 
    },
    is_insured:{
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue:false
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references:{
            model: Department,
            key: 'id'
        }
    },
}, {
    tableName: 'records',
    timestamps: true,
    hooks: {
        beforeCreate: async (record) => {
            // Get current year
            const currentYear = new Date().getFullYear();

            // Count records created this year
            const count = await Record.count({
                where: {
                    createdAt: {
                        [Op.gte]: new Date(`${currentYear}-01-01 00:00:00`),
                        [Op.lt]: new Date(`${currentYear + 1}-01-01 00:00:00`)
                    }
                }
            });

            // Generate Serial Number (e.g., 2024-0001, 2024-0002)
            record.serial_number = `${currentYear}-${String(count + 1).padStart(4, '0')}`;
        }
    }
});

// Define associations
Record.associate = (models) => {
    Record.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    Record.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    Record.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    Record.hasMany(models.Admission, { foreignKey: 'record_id', as: 'admissions' });
    Record.hasMany(models.consultation, { foreignKey: 'record_id', as: 'consultations' });
};

module.exports = Record;
