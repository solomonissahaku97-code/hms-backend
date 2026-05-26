const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const PatientChronicCondition = sequelize.define('PatientChronicCondition', {
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
    // Condition name
    condition_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    // Condition category
    condition_category: {
        type: DataTypes.ENUM(
            'cardiovascular',
            'respiratory',
            'endocrine',
            'renal',
            'neurological',
            'musculoskeletal',
            'gastrointestinal',
            'hematological',
            'infectious',
            'cancer',
            'mental_health',
            'other'
        ),
        allowNull: false
    },
    // ICD-10 code if available
    icd10_code: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    // Disease staging (specific to condition type)
    stage: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'e.g., Stage 1, Stage 2, Stage 3, Stage 4'
    },
    // When was diagnosis made
    diagnosis_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Who made the diagnosis
    diagnosed_by: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    // Where was it diagnosed (hospital name)
    diagnosis_facility: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    // Current status
    status: {
        type: DataTypes.ENUM('active', 'controlled', 'resolved', 'worsening'),
        defaultValue: 'active'
    },
    // Treatment approach
    treatment_type: {
        type: DataTypes.ENUM('medication', 'lifestyle', 'surgical', 'combination', 'monitoring_only'),
        defaultValue: 'medication'
    },
    // Current medications for this condition
    current_medications: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of medication objects'
    },
    // Treatment goals
    treatment_goals: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Last follow-up date
    last_followup_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Next follow-up date
    next_followup_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Follow-up frequency in days
    followup_frequency_days: {
        type: DataTypes.INTEGER,
        defaultValue: 90
    },
    // Complications
    complications: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of complication objects'
    },
    // Notes
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Is the condition considered well-controlled
    is_controlled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Last HbA1c (for diabetes)
    last_hba1c: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    // Last BP reading (for hypertension)
    last_bp_reading: {
        type: DataTypes.STRING(20),
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
    tableName: 'patient_chronic_conditions',
    timestamps: true,
    underscored: true
});

// Define common chronic conditions for Ghana
PatientChronicCondition.COMMON_CONDITIONS = {
    // Cardiovascular
    hypertension: { name: 'Hypertension', category: 'cardiovascular' },
    heart_failure: { name: 'Heart Failure', category: 'cardiovascular' },
    coronary_artery_disease: { name: 'Coronary Artery Disease', category: 'cardiovascular' },
    arrhythmia: { name: 'Cardiac Arrhythmia', category: 'cardiovascular' },
    stroke: { name: 'Stroke', category: 'cardiovascular' },
    
    // Endocrine
    diabetes_type1: { name: 'Type 1 Diabetes', category: 'endocrine' },
    diabetes_type2: { name: 'Type 2 Diabetes', category: 'endocrine' },
    hypothyroidism: { name: 'Hypothyroidism', category: 'endocrine' },
    hyperthyroidism: { name: 'Hyperthyroidism', category: 'endocrine' },
    
    // Respiratory
    asthma: { name: 'Asthma', category: 'respiratory' },
    copd: { name: 'COPD', category: 'respiratory' },
    tuberculosis: { name: 'Tuberculosis', category: 'respiratory' },
    
    // Renal
    chronic_kidney_disease: { name: 'Chronic Kidney Disease', category: 'renal' },
    
    // Hematological
    sickle_cell: { name: 'Sickle Cell Disease', category: 'hematological' },
    anemia: { name: 'Chronic Anemia', category: 'hematological' },
    
    // Mental Health
    depression: { name: 'Depression', category: 'mental_health' },
    anxiety: { name: 'Anxiety Disorder', category: 'mental_health' },
    schizophrenia: { name: 'Schizophrenia', category: 'mental_health' },
    bipolar: { name: 'Bipolar Disorder', category: 'mental_health' },
    
    // Other common in Ghana
    hiv: { name: 'HIV/AIDS', category: 'infectious' },
    hepatitis: { name: 'Hepatitis', category: 'infectious' },
    osteoarthritis: { name: 'Osteoarthritis', category: 'musculoskeletal' },
    epilepsy: { name: 'Epilepsy', category: 'neurological' }
};

// Disease staging based on condition type
PatientChronicCondition.STAGING = {
    hypertension: ['Normal', 'Elevated', 'Stage 1 Hypertension', 'Stage 2 Hypertension', 'Hypertensive Crisis'],
    diabetes_type2: ['Pre-diabetes', 'Type 2 - Initial', 'Type 2 - Controlled', 'Type 2 - Uncontrolled', 'Type 2 - With Complications'],
    chronic_kidney_disease: ['Stage 1', 'Stage 2', 'Stage 3a', 'Stage 3b', 'Stage 4', 'Stage 5 (ESRD)'],
    heart_failure: ['Stage A', 'Stage B', 'Stage C', 'Stage D'],
    copd: ['Stage 1 (Mild)', 'Stage 2 (Moderate)', 'Stage 3 (Severe)', 'Stage 4 (Very Severe)'],
    cancer: ['Stage 0', 'Stage I', 'Stage II', 'Stage III', 'Stage IV']
};

// Associations
PatientChronicCondition.associate = (models) => {
    PatientChronicCondition.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    PatientChronicCondition.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = PatientChronicCondition;

