const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Ensure this path is correct
const Staff = require('./staff');
const Department = require('./department');
const Visit = require('./Visit');

const Diagnosis = sequelize.define('Diagnosis', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Visit, // Ensure this matches the Patients table name
            key: 'id',
        },
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    system_diagnosis_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'system_diagnosis', // Ensure this matches your system_diagnosis table name
            key: 'id'
        }
    },
    diagnosis_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW, // Default to current date and time
        allowNull: false,
        validate: {
            isDate: true, // Ensure the value is a valid date
        }
    },
    status: {
        type: DataTypes.ENUM('Active', 'Resolved', 'Pending'),
        defaultValue: 'Active', // Default status
        allowNull: true,
        validate: {
            isIn: [['Active', 'Resolved', 'Pending']] // Ensure the value is one of the allowed statuses
        }
    },
    chief_complain: {
        type: DataTypes.TEXT,
        allowNull: true, // Allow null values for notes
        validate: {
            notEmpty: true, // Ensure the field is not empty if provided
        }
    },
    doctor_evaluation: {
        type: DataTypes.TEXT,
        allowNull: true, // Allow null values for notes
        validate: {
            notEmpty: true, // Ensure the field is not empty if provided
        }
    },
    diagnosis_type: {
        type: DataTypes.ENUM('provisional_diagnosis', 'confirmed_diagnosis'),
        defaultValue: 'confirmed_diagnosis'
    }




}, {
    tableName: 'diagnosis', // Table name
    modelName: 'Diagnosis', // Model name
    timestamps: true, // If you want Sequelize to automatically add createdAt and updatedAt fields
    underscored: true, // Use snake_case columns
});

Diagnosis.associate = (models) => {
    Diagnosis.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'diagnosis' })
    Diagnosis.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' }); // ADD THIS ASSOCIATION
    Diagnosis.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
    Diagnosis.belongsTo(models.system_diagnosis, { foreignKey: 'system_diagnosis_id', as: 'systemDiagnosis' });



}

module.exports = Diagnosis;
