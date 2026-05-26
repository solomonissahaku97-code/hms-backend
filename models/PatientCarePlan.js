const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Staff = require('./staff'); // Assuming you have a Staff model
const Institution = require('./institution');
const Visit = require('./Visit');

const PatientCarePlan = sequelize.define('PatientCarePlan', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Visit,
            key: 'id',
        },
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id',
        },
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
            key: 'id',
        },
    },
    care_plan_goal: {
        type: DataTypes.STRING, // Storing care plan goals as a JSON array
        allowNull: false,
    },
    interventions: {
        type: DataTypes.TEXT, // Storing interventions as a JSON object to allow flexibility
        allowNull: false,
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    assigned_staff_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Staff,
            key: 'id',
        },
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    priority: {
        type: DataTypes.ENUM('High', 'Medium', 'Low'),
        allowNull: true,
        defaultValue: 'Medium'
    },
    status: {
        type: DataTypes.ENUM('active', 'completed', 'onHold'),
        defaultValue: 'active',
    },
}, {
    sequelize,
    modelName: 'PatientCarePlan',
    tableName: 'patient_care_plans',
    timestamps: true, // This will automatically handle createdAt and updatedAt fields
});

PatientCarePlan.associate = (models) => {
    PatientCarePlan.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'patient' });
    PatientCarePlan.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
    PatientCarePlan.belongsTo(models.Staff, { foreignKey: 'assigned_staff_id', as: 'assigned_staff' });
    PatientCarePlan.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' }); // Added the institution relationship
};

module.exports = PatientCarePlan;
