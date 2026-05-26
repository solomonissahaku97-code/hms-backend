const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const PatientFeedback = sequelize.define('PatientFeedback', {
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
    // Visit/encounter ID
    visit_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    // Feedback type
    feedback_type: {
        type: DataTypes.ENUM(
            'complaint',
            'suggestion',
            'compliment',
            'survey'
        ),
        allowNull: false
    },
    // Category
    category: {
        type: DataTypes.ENUM(
            'waiting_time',
            'staff_behavior',
            'quality_of_care',
            'cleanliness',
            'communication',
            'facilities',
            'billing',
            'other'
        ),
        allowNull: true
    },
    // Rating (1-5)
    rating: {
        type: DataTypes.INTEGER,
        validate: { min: 1, max: 5 }
    },
    // Feedback text
    feedback_text: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    // Status
    status: {
        type: DataTypes.ENUM('pending', 'acknowledged', 'investigating', 'resolved', 'closed'),
        defaultValue: 'pending'
    },
    // Response
    response: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Responded by
    responded_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    // Response date
    response_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Anonymous
    is_anonymous: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'patient_feedback',
    timestamps: true,
    underscored: true
});

// Associations
PatientFeedback.associate = (models) => {
    PatientFeedback.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    PatientFeedback.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
};

module.exports = PatientFeedback;

