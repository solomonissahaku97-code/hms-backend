const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Department = require('./department');
const Institution = require('./institution');
const { truncate } = require('fs/promises'); 

const Patient = sequelize.define('Patient', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    first_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },

    middle_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    last_name: {
        type: DataTypes.STRING(255),
        allowNull: false
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
        allowNull: truncate,
        references: {
            model: Department,
            key: 'id',
        }
    },

    metadata: {
        type: DataTypes.JSON,
        allowNull: true

    },
    status: {
        type: DataTypes.ENUM('active', 'discharged', 'deceased'),
        allowNull: false,
        defaultValue: 'active'
    },
    folder_number: { 
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    date_of_birth: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    gender: {
        type: DataTypes.ENUM('M', 'F'),
        allowNull: true,
        defaultValue: 'M'
    },
    has_insurance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },


}, {
    sequelize,
    modelName: 'Patient',
    timestamps: true,
    tableName: 'patients',
    paranoid: true, // Enables soft deletes
    underscored: true, // Use snake_case for column names

});

// Define associations
Patient.associate = (models) => {
    Patient.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department', onDelete: 'CASCADE' });
    Patient.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    Patient.hasMany(models.ServiceBill, { foreignKey: 'patient_id', as: 'serviceBills', onDelete: 'CASCADE' });
    Patient.hasMany(models.VitalSignsRecord, { foreignKey: 'patient_id', as: 'vitalSignsRecords', onDelete: 'CASCADE' });
    Patient.hasMany(models.PatientCarePlan, { foreignKey: 'patient_id', as: 'patientCarePlan', onDelete: 'CASCADE' });
    Patient.hasMany(models.Appointment, { foreignKey: 'patient_id', as: 'appointment', onDelete: 'CASCADE' });
    Patient.hasMany(models.Diagnosis, { foreignKey: 'patient_id', as: 'diagnosis', onDelete: 'CASCADE' });
    Patient.hasMany(models.LabResult, { foreignKey: 'patient_id', as: 'labResults', onDelete: 'CASCADE' });
    Patient.hasMany(models.Prescription, { foreignKey: 'patient_id', as: 'prescriptions', onDelete: 'CASCADE' });
    Patient.hasMany(models.Procedure, { foreignKey: 'patient_id', as: 'procedures', onDelete: 'CASCADE' });
    Patient.hasOne(models.Bed, { foreignKey: 'patient_id', as: 'bed', onDelete: 'SET NULL' });
    Patient.belongsTo(models.Record, { foreignKey: 'record_id', as: 'records', });
    Patient.hasMany(models.MedicalHistory, { foreignKey: 'patient_id', as: 'medical_histories' });
    Patient.hasMany(models.ObstetricHistory, { foreignKey: 'patient_id', as: 'obstetric_histories' });
    Patient.hasMany(models.PregnancyHistory, { foreignKey: 'patient_id', as: 'pregnancy_histories' });
    Patient.hasMany(models.ImmunizationHistory, { foreignKey: 'patient_id', as: 'immunization_histories' });
    Patient.hasMany(models.Visit, { foreignKey: 'patient_id', as: 'visits', onDelete: 'CASCADE' });
    Patient.hasOne(models.Insurance, { foreignKey: 'patient_id', as: 'insurance' });
    
    // NEW: Advanced Patient Features Associations
    Patient.hasMany(models.PatientAllergy, { foreignKey: 'patient_id', as: 'allergies', onDelete: 'CASCADE' });
    Patient.hasMany(models.PatientChronicCondition, { foreignKey: 'patient_id', as: 'chronicConditions', onDelete: 'CASCADE' });
    Patient.hasMany(models.PatientRiskAssessment, { foreignKey: 'patient_id', as: 'riskAssessments', onDelete: 'CASCADE' });
    Patient.hasMany(models.FamilyHealthHistory, { foreignKey: 'patient_id', as: 'familyHistory', onDelete: 'CASCADE' });
    Patient.hasMany(models.SocialDeterminantsOfHealth, { foreignKey: 'patient_id', as: 'sdoh', onDelete: 'CASCADE' });
    Patient.hasMany(models.MedicationAdherence, { foreignKey: 'patient_id', as: 'medicationAdherence', onDelete: 'CASCADE' });
    Patient.hasMany(models.ScreeningReminder, { foreignKey: 'patient_id', as: 'screenings', onDelete: 'CASCADE' });
    Patient.hasMany(models.WellnessScore, { foreignKey: 'patient_id', as: 'wellnessScores', onDelete: 'CASCADE' });
    Patient.hasMany(models.PatientFeedback, { foreignKey: 'patient_id', as: 'feedback', onDelete: 'CASCADE' });
    Patient.hasMany(models.OrganDonor, { foreignKey: 'patient_id', as: 'organDonor', onDelete: 'CASCADE' });
    
};

module.exports = Patient;
