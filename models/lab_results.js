const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Department = require('./department');
const Staff = require('./staff');
const Patient = require('./patient'); // Import Patient model
const Test = require('./test');

const LabResult = sequelize.define('LabResult', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },

    doctor_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    lab_technician_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    test: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    test_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    comment: {
        type: DataTypes.TEXT,
    },
    results_comment: {
        type: DataTypes.TEXT,
    },
    patient_id: { // Add onDelete: 'CASCADE' to patient_id
        type: DataTypes.UUID,
        allowNull: false,
        onDelete: 'CASCADE', // Cascade delete on patient_id
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    status: {
        type: DataTypes.ENUM('requested', 'in-progress', 'completed', 'cancelled'),
        defaultValue: 'requested'
    },
}, {
    tableName: 'lab_results',
    timestamps: true,
});

// Define associations
LabResult.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });
LabResult.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });
LabResult.belongsTo(Staff, { foreignKey: 'doctor_id', as: 'staff' });
LabResult.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient', onDelete: 'CASCADE' });
LabResult.belongsTo(Test, { foreignKey: 'test_id', as: 'test_name' });


module.exports = LabResult;
