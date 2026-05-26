const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const FamilyHealthHistory = sequelize.define('FamilyHealthHistory', {
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
        allowNull: true,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    // Relationship to patient
    relationship: {
        type: DataTypes.ENUM(
            'father',
            'mother',
            'brother',
            'sister',
            'son',
            'daughter',
            'grandfather',
            'grandmother',
            'aunt',
            'uncle',
            'cousin',
            'spouse',
            'other'
        ),
        allowNull: false
    },
    // First name (optional for privacy)
    first_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    // Age or age at death
    age: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // If deceased
    is_deceased: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Age at death
    age_at_death: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Cause of death (if applicable)
    cause_of_death: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    // Medical conditions
    conditions: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of condition objects with name, icd10, age_at_onset'
    },
    // Age when condition was diagnosed
    condition_onset_age: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Notes
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Recorded by
    recorded_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    // Active status
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'family_health_history',
    timestamps: true,
    underscored: true
});

// Common family conditions for Ghana
FamilyHealthHistory.COMMON_CONDITIONS = [
    'Hypertension',
    'Diabetes (Type 2)',
    'Diabetes (Type 1)',
    'Heart Disease',
    'Stroke',
    'Kidney Disease',
    'Cancer',
    'Sickle Cell Disease',
    'Sickle Cell Trait',
    'Asthma',
    'Epilepsy',
    'Mental Health Condition',
    'Thyroid Disorder',
    'High Cholesterol',
    'Asthma',
    'Tuberculosis',
    'HIV/AIDS',
    'Liver Disease',
    'Arthritis',
    'Blindness',
    'Deafness'
];

// Associations
FamilyHealthHistory.associate = (models) => {
    FamilyHealthHistory.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    FamilyHealthHistory.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = FamilyHealthHistory;

