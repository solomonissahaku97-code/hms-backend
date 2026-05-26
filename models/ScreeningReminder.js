const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const ScreeningReminder = sequelize.define('ScreeningReminder', {
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
    // Screening type
    screening_type: {
        type: DataTypes.ENUM(
            'cervical_cancer',
            'breast_cancer',
            'prostate_cancer',
            'colorectal_cancer',
            'diabetic_eye',
            'diabetic_foot',
            'blood_pressure',
            'cholesterol',
            'hiv',
            'tb',
            'hepatitis_b',
            'hepatitis_c',
            'custom'
        ),
        allowNull: false
    },
    // Custom screening name (if custom)
    custom_screening_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    // Recommended date
    recommended_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Actual date completed
    completed_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Status
    status: {
        type: DataTypes.ENUM(
            'pending',
            'due',
            'overdue',
            'completed',
            'scheduled',
            'cancelled',
            'not_applicable'
        ),
        defaultValue: 'pending'
    },
    // Result (if completed)
    result: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Findings
    findings: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Follow-up required
    follow_up_required: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Next screening due
    next_screening_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Frequency in months
    frequency_months: {
        type: DataTypes.INTEGER,
        defaultValue: 12
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
    // Is active
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'screening_reminders',
    timestamps: true,
    underscored: true
});

// Screening guidelines
ScreeningReminder.SCREENING_GUIDELINES = {
    cervical_cancer: {
        name: 'Cervical Cancer (VIA/Pap smear)',
        female: true,
        start_age: 21,
        frequency: 36, // 3 years
        stop_age: 65
    },
    breast_cancer: {
        name: 'Breast Cancer (Mammography)',
        female: true,
        start_age: 40,
        frequency: 24, // 2 years
        stop_age: 75
    },
    prostate_cancer: {
        name: 'Prostate Cancer (PSA)',
        male: true,
        start_age: 50,
        frequency: 12,
        stop_age: 70
    },
    diabetic_eye: {
        name: 'Diabetic Eye Exam',
        condition: 'diabetes',
        frequency: 12,
        condition_type: 'chronic'
    },
    diabetic_foot: {
        name: 'Diabetic Foot Exam',
        condition: 'diabetes',
        frequency: 12,
        condition_type: 'chronic'
    },
    blood_pressure: {
        name: 'Blood Pressure Screening',
        all: true,
        frequency: 12
    },
    cholesterol: {
        name: 'Cholesterol Screening',
        start_age: 20,
        frequency: 48 // 4 years
    },
    hiv: {
        name: 'HIV Screening',
        all: true,
        frequency: 12
    },
    tb: {
        name: 'TB Screening',
        at_risk: true,
        frequency: 12
    }
};

// Associations
ScreeningReminder.associate = (models) => {
    ScreeningReminder.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    ScreeningReminder.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = ScreeningReminder;

