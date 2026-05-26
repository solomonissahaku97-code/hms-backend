const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const MedicationAdherence = sequelize.define('MedicationAdherence', {
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
    // Prescription ID (if tracking specific medication)
    prescription_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    // Medication name
    medication_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    // Dosage
    dosage: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    // Frequency
    frequency: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    // Adherence score (0-100)
    adherence_score: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Adherence method
    adherence_method: {
        type: DataTypes.ENUM(
            'self_report',
            'pill_count',
            'pharmacy_pickup',
            'morisky_scale',
            'electronic_monitoring'
        ),
        defaultValue: 'self_report'
    },
    // Days monitored
    days_monitored: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // Days taken correctly
    days_taken_correctly: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // Days missed
    days_missed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // Reasons for non-adherence
    non_adherence_reasons: {
        type: DataTypes.JSON,
        allowNull: true
    },
    // Side effects experienced
    side_effects: {
        type: DataTypes.JSON,
        allowNull: true
    },
    // Assessment date
    assessment_date: {
        type: DataTypes.DATEONLY,
        defaultValue: DataTypes.NOW
    },
    // Next assessment date
    next_assessment_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Notes
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Assessed by
    assessed_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    // Is active
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'medication_adherence',
    timestamps: true,
    underscored: true
});

// Calculate adherence score
MedicationAdherence.calculateAdherenceScore = (daysTaken, totalDays) => {
    if (totalDays === 0) return 0;
    return Math.round((daysTaken / totalDays) * 100);
};

// Associations
MedicationAdherence.associate = (models) => {
    MedicationAdherence.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    MedicationAdherence.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = MedicationAdherence;

