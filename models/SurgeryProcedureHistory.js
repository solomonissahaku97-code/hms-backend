const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient'); // Assuming you have a Patient model
const Staff = require('./staff'); // Assuming you have a Staff model (for the surgeon)

const SurgeryProcedureHistory = sequelize.define('SurgeryProcedureHistory', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,

    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Patient,
            key: 'id',
        },
    },
    surgeon_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
            key: 'id',
        },
    },
    procedure_type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    procedure_date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    outcome: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    sequelize,
    modelName: 'SurgeryProcedureHistory',
    tableName: 'surgery_procedure_histories',
    timestamps: true,
});

SurgeryProcedureHistory.associate = (models) => {
    SurgeryProcedureHistory.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    SurgeryProcedureHistory.belongsTo(models.Staff, { foreignKey: 'surgeon_id', as: 'surgeon' });
};

module.exports = SurgeryProcedureHistory;
