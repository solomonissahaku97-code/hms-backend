const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');
const Department = require('./department');
const Test = require('./test');
const Staff = require('./staff');

const LabScreeningRequest = sequelize.define('LabScreeningRequest', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    doctor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Patient,
            key: 'id'
        }
    },
    status: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    priority: {
        type: DataTypes.STRING(20),
    },
    test_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Test,
            key: 'id'
        }
    },
    message: {
        type: DataTypes.TEXT('long'),
    },
    department_id: {
        type: DataTypes.UUID,
        references: {
            model: Department,
            key: 'id'
        }
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    tableName: 'lab_screening_request',
    modelName: 'LabScreeningRequest',
    timestamps: false,
});

// Define associations
LabScreeningRequest.associate = (models) => {
    LabScreeningRequest.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    LabScreeningRequest.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    LabScreeningRequest.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    LabScreeningRequest.belongsTo(models.Test, { foreignKey: 'test_id', as: 'test' });
    LabScreeningRequest.belongsTo(models.Staff, { foreignKey: 'doctor_id', as: 'staff' });
};

module.exports = LabScreeningRequest;
