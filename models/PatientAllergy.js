const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const PatientAllergy = sequelize.define('PatientAllergy', {
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
    // Allergy Type
    allergy_type: {
        type: DataTypes.ENUM(
            'drug',
            'food',
            'environmental',
            'biological',
            'other',
            'unknown'
        ),
        allowNull: false,
        defaultValue: 'drug'
    },
    // Specific allergen (e.g., Penicillin, Peanuts, Pollen)
    allergen: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    // Severity of reaction
    severity: {
        type: DataTypes.ENUM(
            'mild',
            'moderate',
            'severe',
            'anaphylaxis',
            'unknown'
        ),
        allowNull: false,
        defaultValue: 'moderate'
    },
    // Type of reaction
    reaction_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'e.g., rash, swelling, breathing difficulty'
    },
    // Description of the reaction
    reaction_description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // When the allergy was first discovered
    onset_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Last time patient had a reaction
    last_reaction_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Is it a confirmed allergy or suspected?
    is_confirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Who identified the allergy
    identified_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'e.g., Self-reported, Physician, Allergist'
    },
    // Verification status
    verification_status: {
        type: DataTypes.ENUM('verified', 'unverified', 'ruled_out'),
        defaultValue: 'unverified'
    },
    // Notes
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Active status
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    // Staff who recorded this
    recorded_by: {
        type: DataTypes.UUID,
        allowNull: true
    }
}, {
    tableName: 'patient_allergies',
    timestamps: true,
    underscored: true
});

// Associations
PatientAllergy.associate = (models) => {
    PatientAllergy.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    PatientAllergy.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = PatientAllergy;

