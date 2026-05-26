const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Staff = require('./staff');
const Institution = require('./institution'); // Assuming you have an Institution model
const Department = require('./department');   // Assuming you have a Department model

const TreatmentPlan = sequelize.define('treatmentPlan', {
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
            key: 'id'
        }
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
    treatment_description: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    medication: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    dosage: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    sequelize,
    modelName: 'TreatmentPlan',
    tableName: 'treatment_plans',
    timestamps: true,
});

TreatmentPlan.associate = (models) => {
    TreatmentPlan.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    TreatmentPlan.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
    TreatmentPlan.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    TreatmentPlan.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
};

module.exports = TreatmentPlan;
