const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Prescription = require('./prescription');
const Staff = require('./staff');


const PatientMedicationCounseling = sequelize.define('PatientMedicationCounseling', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'visits', // Reference table name
            key: 'id'
        }
    },
    prescription_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Prescription, // Reference table name
            key: 'id'
        }
    },
    language: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    duration: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    topic_covered: {
        type: DataTypes.TEXT, // Changed to TEXT for longer content
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    staff_requester_id: {  // Renamed for clarity
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff, // Reference table name
            key: 'id'
        }
    },
    staff_instructor_id: {  // Renamed for clarity
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Staff, // Reference table name
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'fulfilled'),
        allowNull: false,
        defaultValue: 'pending'
    },
    counseling_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
   
}, {
    sequelize,
    timestamps: true,
    tableName: 'patient_medication_counselings', // explicit table name
    paranoid: true // soft deletes
});

// Define associations
PatientMedicationCounseling.associate = (models) => {
    PatientMedicationCounseling.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });
    
    PatientMedicationCounseling.belongsTo(models.Prescription, {
        foreignKey: 'prescription_id',
        as: 'prescription'
    });
    
    PatientMedicationCounseling.belongsTo(models.Staff, {
        foreignKey: 'staff_requester_id',
        as: 'requester'
    });
    
    PatientMedicationCounseling.belongsTo(models.Staff, {
        foreignKey: 'staff_instructor_id',
        as: 'instructor'
    });
    
  
};

module.exports = PatientMedicationCounseling;