const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const SocialDeterminantsOfHealth = sequelize.define('SocialDeterminantsOfHealth', {
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
    // Employment status
    employment_status: {
        type: DataTypes.ENUM(
            'employed_full_time',
            'employed_part_time',
            'self_employed',
            'unemployed',
            'student',
            'retired',
            'homemaker',
            'disability',
            'other'
        ),
        allowNull: true
    },
    // Occupation
    occupation: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    // Employer name
    employer_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    // Education level
    education_level: {
        type: DataTypes.ENUM(
            'none',
            'primary',
            'jhs',
            'shs',
            'tertiary',
            'post_graduate'
        ),
        allowNull: true
    },
    // Monthly income bracket
    income_bracket: {
        type: DataTypes.ENUM(
            'none',
            'below_500',
            '500_1000',
            '1000_2000',
            '2000_5000',
            'above_5000',
            'undisclosed'
        ),
        allowNull: true
    },
    // Housing type
    housing_type: {
        type: DataTypes.ENUM(
            'owned',
            'rented',
            'family_owned',
            'shared',
            'homeless',
            'other'
        ),
        allowNull: true
    },
    // Number of people in household
    household_size: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Distance to health facility (km)
    distance_to_facility: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    // Transport mode to facility
    transport_mode: {
        type: DataTypes.ENUM(
            'walking',
            'public_transport',
            'taxi',
            'personal_vehicle',
            'ambulance',
            'other'
        ),
        allowNull: true
    },
    // Access to clean water
    has_clean_water: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    // Has sanitation facility
    has_sanitation: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    // Has electricity
    has_electricity: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    // Has phone/mobile
    has_mobile_phone: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    // Has internet access
    has_internet: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Insurance status changes
    insurance_changes: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of insurance status changes'
    },
    // Food security
    food_security: {
        type: DataTypes.ENUM(
            'secure',
            'moderate_insecurity',
            'severe_insecurity'
        ),
        defaultValue: 'secure'
    },
    // Social support level
    social_support: {
        type: DataTypes.ENUM(
            'strong',
            'moderate',
            'weak',
            'none'
        ),
        defaultValue: 'moderate'
    },
    // Risk factors identified
    risk_factors: {
        type: DataTypes.JSON,
        allowNull: true
    },
    // Notes
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Assessment date
    assessment_date: {
        type: DataTypes.DATEONLY,
        defaultValue: DataTypes.NOW
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
    tableName: 'social_determinants_health',
    timestamps: true,
    underscored: true
});

// Associations
SocialDeterminantsOfHealth.associate = (models) => {
    SocialDeterminantsOfHealth.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    SocialDeterminantsOfHealth.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = SocialDeterminantsOfHealth;

