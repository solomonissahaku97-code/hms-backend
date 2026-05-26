const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const WellnessScore = sequelize.define('WellnessScore', {
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
    // Overall wellness score (0-100)
    overall_score: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Physical health score
    physical_score: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Mental health score
    mental_score: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Lifestyle score
    lifestyle_score: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Risk score (inverse - lower is better)
    risk_score: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // BMI component
    bmi_component: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Activity level
    activity_component: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Nutrition component
    nutrition_component: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Sleep component
    sleep_component: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Stress component
    stress_component: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Social component
    social_component: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Risk factors present
    risk_factors: {
        type: DataTypes.JSON,
        allowNull: true
    },
    // Health goals
    health_goals: {
        type: DataTypes.JSON,
        allowNull: true
    },
    // Recommendations
    recommendations: {
        type: DataTypes.TEXT,
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
    tableName: 'wellness_scores',
    timestamps: true,
    underscored: true
});

// Calculate wellness score
WellnessScore.calculateScore = (vitals, lifestyle, riskFactors) => {
    let physical = 50;
    let mental = 50;
     lifestyle = 50;
    let risk = 0;

    // BMI contribution (25 is ideal)
    if (vitals.bmi) {
        if (vitals.bmi >= 18.5 && vitals.bmi < 25) {
            physical += 20;
        } else if (vitals.bmi >= 25 && vitals.bmi < 30) {
            physical += 10;
            risk += 10;
        } else {
            risk += 20;
        }
    }

    // Blood pressure contribution
    if (vitals.systole && vitals.diastole) {
        if (vitals.systole < 120 && vitals.diastole < 80) {
            physical += 15;
        } else if (vitals.systole < 140 && vitals.diastole < 90) {
            physical += 5;
            risk += 10;
        } else {
            risk += 20;
        }
    }

    // Activity level
    if (lifestyle.activity_level === 'high') {
        lifestyle += 25;
    } else if (lifestyle.activity_level === 'moderate') {
        lifestyle += 15;
    } else if (lifestyle.activity_level === 'low') {
        risk += 15;
    }

    // Risk factors
    if (riskFactors) {
        risk += riskFactors.length * 5;
    }

    risk = Math.min(risk, 50); // Cap at 50

    const overall = Math.round((physical + mental + lifestyle + (50 - risk)) / 4);

    return {
        overall_score: Math.min(Math.max(overall, 0), 100),
        physical_score: Math.min(Math.max(physical, 0), 100),
        mental_score: Math.min(Math.max(mental, 0), 100),
        lifestyle_score: Math.min(Math.max(lifestyle, 0), 100),
        risk_score: Math.min(risk, 100)
    };
};

// Associations
WellnessScore.associate = (models) => {
    WellnessScore.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    WellnessScore.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = WellnessScore;

