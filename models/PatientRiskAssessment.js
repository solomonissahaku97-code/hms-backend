const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const PatientRiskAssessment = sequelize.define('PatientRiskAssessment', {
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
    // Assessment type
    assessment_type: {
        type: DataTypes.ENUM(
            'cardiovascular',
            'diabetes',
            'fall_risk',
            'stroke',
            'cancer_screening',
            'general_health',
            'nutrition',
            'mental_health'
        ),
        allowNull: false
    },
    // Assessment date
    assessment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    // Age at assessment
    age: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Gender
    gender: {
        type: DataTypes.ENUM('M', 'F'),
        allowNull: true
    },
    // Risk score (0-100)
    risk_score: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    // Risk category
    risk_category: {
        type: DataTypes.ENUM('low', 'moderate', 'high', 'very_high', 'critical'),
        allowNull: true
    },
    // Input values stored as JSON
    input_values: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Stores all input values used in calculation'
    },
    // Risk factors identified
    risk_factors: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of risk factors identified'
    },
    // Protective factors
    protective_factors: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of protective factors'
    },
    // Recommendations
    recommendations: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Next assessment due date
    next_assessment_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Assessment status
    status: {
        type: DataTypes.ENUM('completed', 'in_progress', 'follow_up_required'),
        defaultValue: 'completed'
    },
    // Staff who performed assessment
    assessed_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    // Notes
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Is active (for tracking history)
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'patient_risk_assessments',
    timestamps: true,
    underscored: true
});

// Risk calculation constants
PatientRiskAssessment.CARDIOVASCULAR_RISK = {
    // Framingham Risk Score factors
    factors: ['age', 'gender', 'systolic_bp', 'total_cholesterol', 'hdl_cholesterol', 'smoking', 'diabetes', 'treatment'],
    // Risk thresholds
    thresholds: {
        low: 10,       // <10% 10-year risk
        moderate: 20,  // 10-20% 10-year risk
        high: 30,      // 20-30% 10-year risk
        very_high: 100 // >30% 10-year risk
    }
};

PatientRiskAssessment.DIABETES_RISK = {
    // ADA Diabetes Risk Test factors
    factors: ['age', 'bmi', 'waist_circumference', 'physical_activity', 'family_history', 'ethnicity', 'blood_glucose'],
    thresholds: {
        low: 3,
        moderate: 7,
        high: 15,
        very_high: 100
    }
};

PatientRiskAssessment.FALL_RISK = {
    // Morse Fall Scale factors
    factors: ['history_falls', 'secondary_diagnosis', 'ambulatory_aid', 'iv_therapy', 'gait', 'mental_status'],
    thresholds: {
        low: 25,
        moderate: 50,
        high: 100,
        very_high: 125
    }
};

// Calculate cardiovascular risk using Framingham-inspired algorithm
PatientRiskAssessment.calculateCardiovascularRisk = (inputs) => {
    let score = 0;
    const riskFactors = [];
    const protectiveFactors = [];

    // Age factor (increases with age)
    if (inputs.age >= 45) {
        score += (inputs.age - 44) * 1.5;
        riskFactors.push(`Age ${inputs.age} years`);
    }

    // Gender factor (men higher risk)
    if (inputs.gender === 'M') {
        score += 2;
        riskFactors.push('Male gender');
    } else {
        protectiveFactors.push('Female gender (lower baseline risk)');
    }

    // Blood pressure
    if (inputs.systolic_bp) {
        if (inputs.systolic_bp >= 180) {
            score += 15;
            riskFactors.push('Hypertensive crisis (BP ≥180)');
        } else if (inputs.systolic_bp >= 160) {
            score += 10;
            riskFactors.push('Stage 2 hypertension (BP 160-179)');
        } else if (inputs.systolic_bp >= 140) {
            score += 5;
            riskFactors.push('Stage 1 hypertension (BP 140-159)');
        } else if (inputs.systolic_bp >= 130) {
            score += 2;
            riskFactors.push('Elevated blood pressure');
        } else {
            protectiveFactors.push('Normal blood pressure');
        }
    }

    // Cholesterol
    if (inputs.total_cholesterol) {
        if (inputs.total_cholesterol >= 280) {
            score += 10;
            riskFactors.push('Very high cholesterol (≥280 mg/dL)');
        } else if (inputs.total_cholesterol >= 240) {
            score += 5;
            riskFactors.push('High cholesterol (240-279 mg/dL)');
        } else if (inputs.total_cholesterol >= 200) {
            score += 2;
            riskFactors.push('Borderline high cholesterol');
        }
    }

    if (inputs.hdl_cholesterol) {
        if (inputs.hdl_cholesterol < 40) {
            score += 5;
            riskFactors.push('Low HDL cholesterol');
        } else if (inputs.hdl_cholesterol >= 60) {
            protectiveFactors.push('High HDL cholesterol (protective)');
        }
    }

    // Lifestyle factors
    if (inputs.smoking) {
        score += 10;
        riskFactors.push('Current smoker');
    } else {
        protectiveFactors.push('Non-smoker');
    }

    if (inputs.diabetes) {
        score += 8;
        riskFactors.push('Diabetes mellitus');
    }

    if (inputs.physical_activity === 'sedentary') {
        score += 5;
        riskFactors.push('Sedentary lifestyle');
    } else if (inputs.physical_activity === 'moderate' || inputs.physical_activity === 'active') {
        protectiveFactors.push('Regular physical activity');
    }

    // Family history
    if (inputs.family_history_cvd) {
        score += 5;
        riskFactors.push('Family history of CVD');
    }

    // Calculate risk category
    let riskCategory = 'low';
    if (score >= 30) riskCategory = 'very_high';
    else if (score >= 20) riskCategory = 'high';
    else if (score >= 10) riskCategory = 'moderate';

    return {
        risk_score: Math.min(score, 100),
        risk_category: riskCategory,
        risk_factors: riskFactors,
        protective_factors: protectiveFactors
    };
};

// Calculate diabetes risk
PatientRiskAssessment.calculateDiabetesRisk = (inputs) => {
    let score = 0;
    const riskFactors = [];
    const protectiveFactors = [];

    // Age
    if (inputs.age) {
        if (inputs.age >= 65) {
            score += 9;
            riskFactors.push('Age 65 or older');
        } else if (inputs.age >= 55) {
            score += 6;
            riskFactors.push('Age 55-64');
        } else if (inputs.age >= 45) {
            score += 4;
            riskFactors.push('Age 45-54');
        }
    }

    // BMI
    if (inputs.bmi) {
        if (inputs.bmi >= 35) {
            score += 8;
            riskFactors.push('BMI ≥35 (Obese Class II)');
        } else if (inputs.bmi >= 30) {
            score += 5;
            riskFactors.push('BMI 30-34.9 (Obese Class I)');
        } else if (inputs.bmi >= 25) {
            score += 2;
            riskFactors.push('BMI 25-29.9 (Overweight)');
        } else {
            protectiveFactors.push('Normal BMI');
        }
    }

    // Waist circumference
    if (inputs.waist_circumference) {
        if (inputs.gender === 'M') {
            if (inputs.waist_circumference >= 102) {
                score += 10;
                riskFactors.push('Large waist (men ≥102cm)');
            } else if (inputs.waist_circumference >= 94) {
                score += 5;
                riskFactors.push('Increased waist (men 94-101cm)');
            }
        } else {
            if (inputs.waist_circumference >= 88) {
                score += 10;
                riskFactors.push('Large waist (women ≥88cm)');
            } else if (inputs.waist_circumference >= 80) {
                score += 5;
                riskFactors.push('Increased waist (women 80-87cm)');
            }
        }
    }

    // Physical activity
    if (inputs.physical_activity === 'none') {
        score += 5;
        riskFactors.push('No regular physical activity');
    } else {
        protectiveFactors.push('Regular physical activity');
    }

    // Family history
    if (inputs.family_history_diabetes) {
        score += 8;
        riskFactors.push('Family history of diabetes');
    }

    // High risk ethnicity (African)
    if (inputs.ethnicity === 'african') {
        score += 5;
        riskFactors.push('African ancestry (higher risk)');
    }

    // Previous blood glucose
    if (inputs.previous_high_glucose) {
        score += 10;
        riskFactors.push('History of high blood glucose');
    }

    // Calculate risk category
    let riskCategory = 'low';
    if (score >= 15) riskCategory = 'very_high';
    else if (score >= 10) riskCategory = 'high';
    else if (score >= 7) riskCategory = 'moderate';

    return {
        risk_score: Math.min(score, 100),
        risk_category: riskCategory,
        risk_factors: riskFactors,
        protective_factors: protectiveFactors
    };
};

// Calculate fall risk (Morse Fall Scale)
PatientRiskAssessment.calculateFallRisk = (inputs) => {
    let score = 0;
    const riskFactors = [];

    // History of falls
    if (inputs.history_falls === 'yes') {
        score += 25;
        riskFactors.push('History of falls');
    } else if (inputs.history_falls === 'within_3_months') {
        score += 25;
        riskFactors.push('Fall within last 3 months');
    }

    // Secondary diagnosis
    if (inputs.secondary_diagnosis === 'yes') {
        score += 15;
        riskFactors.push('Multiple diagnoses');
    }

    // Ambulatory aid
    if (inputs.ambulatory_aid === 'bed_bound') {
        score += 0;
    } else if (inputs.ambulatory_aid === 'crutches') {
        score += 15;
        riskFactors.push('Uses crutches/cane');
    } else if (inputs.ambulatory_aid === 'walker') {
        score += 30;
        riskFactors.push('Uses walker');
    } else if (inputs.ambulatory_aid === 'furniture') {
        score += 30;
        riskFactors.push('Furniture walking');
    }

    // IV therapy
    if (inputs.iv_therapy === 'yes') {
        score += 20;
        riskFactors.push('Currently on IV therapy');
    }

    // Gait
    if (inputs.gait === 'impaired') {
        score += 20;
        riskFactors.push('Impaired gait');
    } else if (inputs.gait === 'weak') {
        score += 10;
        riskFactors.push('Weak gait');
    }

    // Mental status
    if (inputs.mental_status === 'forgetful') {
        score += 15;
        riskFactors.push('Forgetful/Impaired memory');
    }

    // Calculate risk category
    let riskCategory = 'low';
    if (score >= 125) riskCategory = 'very_high';
    else if (score >= 100) riskCategory = 'high';
    else if (score >= 50) riskCategory = 'moderate';

    return {
        risk_score: score,
        risk_category: riskCategory,
        risk_factors: riskFactors,
        protective_factors: []
    };
};

// Associations
PatientRiskAssessment.associate = (models) => {
    PatientRiskAssessment.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    PatientRiskAssessment.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = PatientRiskAssessment;

