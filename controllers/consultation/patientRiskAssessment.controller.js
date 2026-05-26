const PatientRiskAssessment = require('../../models/PatientRiskAssessment');
const Patient = require('../../models/patient');

// Create a new risk assessment
exports.createRiskAssessment = async (req, res) => {
    try {
        const {
            patient_id,
            institution_id,
            assessment_type,
            age,
            gender,
            input_values,
            assessed_by,
            notes
        } = req.body;

        // Check if patient exists
        const patient = await Patient.findByPk(patient_id);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Calculate risk based on assessment type
        let riskResult;
        switch (assessment_type) {
            case 'cardiovascular':
                riskResult = PatientRiskAssessment.calculateCardiovascularRisk(input_values);
                break;
            case 'diabetes':
                riskResult = PatientRiskAssessment.calculateDiabetesRisk(input_values);
                break;
            case 'fall_risk':
                riskResult = PatientRiskAssessment.calculateFallRisk(input_values);
                break;
            default:
                return res.status(400).json({ message: 'Invalid assessment type' });
        }

        // Calculate next assessment date (typically 1 year for most, 6 months for high risk)
        const nextAssessmentDate = new Date();
        if (riskResult.risk_category === 'high' || riskResult.risk_category === 'very_high') {
            nextAssessmentDate.setMonth(nextAssessmentDate.getMonth() + 6);
        } else {
            nextAssessmentDate.setFullYear(nextAssessmentDate.getFullYear() + 1);
        }

        // Generate recommendations based on risk
        const recommendations = generateRecommendations(assessment_type, riskResult);

        const assessment = await PatientRiskAssessment.create({
            patient_id,
            institution_id,
            assessment_type,
            assessment_date: new Date(),
            age,
            gender,
            risk_score: riskResult.risk_score,
            risk_category: riskResult.risk_category,
            input_values,
            risk_factors: riskResult.risk_factors,
            protective_factors: riskResult.protective_factors,
            recommendations,
            next_assessment_date: nextAssessmentDate,
            status: 'completed',
            assessed_by,
            notes
        });

        res.status(201).json({
            message: 'Risk assessment completed successfully',
            assessment,
            risk_result: riskResult
        });
    } catch (error) {
        console.error('Error creating risk assessment:', error);
        res.status(500).json({ message: 'Error creating risk assessment', error: error.message });
    }
};

// Get all risk assessments for a patient
exports.getPatientRiskAssessments = async (req, res) => {
    try {
        const { patient_id } = req.params;
        const { institution_id, assessment_type } = req.query;

        const where = { patient_id };
        if (institution_id) where.institution_id = institution_id;
        if (assessment_type) where.assessment_type = assessment_type;

        const assessments = await PatientRiskAssessment.findAll({
            where,
            order: [['assessment_date', 'DESC']]
        });

        res.json({
            message: 'Risk assessments retrieved successfully',
            assessments,
            count: assessments.length
        });
    } catch (error) {
        console.error('Error fetching risk assessments:', error);
        res.status(500).json({ message: 'Error fetching risk assessments', error: error.message });
    }
};

// Get latest risk assessment by type
exports.getLatestRiskAssessment = async (req, res) => {
    try {
        const { patient_id, assessment_type } = req.params;
        const { institution_id } = req.query;

        const where = {
            patient_id,
            assessment_type,
            is_active: true
        };
        if (institution_id) where.institution_id = institution_id;

        const assessment = await PatientRiskAssessment.findOne({
            where,
            order: [['assessment_date', 'DESC']]
        });

        if (!assessment) {
            return res.status(404).json({ message: 'No risk assessment found' });
        }

        res.json({
            message: 'Latest risk assessment retrieved successfully',
            assessment
        });
    } catch (error) {
        console.error('Error fetching latest risk assessment:', error);
        res.status(500).json({ message: 'Error fetching latest risk assessment', error: error.message });
    }
};

// Get single assessment by ID
exports.getRiskAssessmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const assessment = await PatientRiskAssessment.findByPk(id, {
            include: ['patient']
        });

        if (!assessment) {
            return res.status(404).json({ message: 'Risk assessment not found' });
        }

        res.json({
            message: 'Risk assessment retrieved successfully',
            assessment
        });
    } catch (error) {
        console.error('Error fetching risk assessment:', error);
        res.status(500).json({ message: 'Error fetching risk assessment', error: error.message });
    }
};

// Update risk assessment
exports.updateRiskAssessment = async (req, res) => {
    try {
        const { id } = req.params;

        const assessment = await PatientRiskAssessment.findByPk(id);
        if (!assessment) {
            return res.status(404).json({ message: 'Risk assessment not found' });
        }

        const updatedAssessment = await assessment.update(req.body);

        res.json({
            message: 'Risk assessment updated successfully',
            assessment: updatedAssessment
        });
    } catch (error) {
        console.error('Error updating risk assessment:', error);
        res.status(500).json({ message: 'Error updating risk assessment', error: error.message });
    }
};

// Delete (soft delete) risk assessment
exports.deleteRiskAssessment = async (req, res) => {
    try {
        const { id } = req.params;

        const assessment = await PatientRiskAssessment.findByPk(id);
        if (!assessment) {
            return res.status(404).json({ message: 'Risk assessment not found' });
        }

        await assessment.update({ is_active: false });

        res.json({ message: 'Risk assessment deleted successfully' });
    } catch (error) {
        console.error('Error deleting risk assessment:', error);
        res.status(500).json({ message: 'Error deleting risk assessment', error: error.message });
    }
};

// Get risk summary for patient
exports.getRiskSummary = async (req, res) => {
    try {
        const { patient_id } = req.params;

        const assessments = await PatientRiskAssessment.findAll({
            where: {
                patient_id,
                is_active: true
            },
            attributes: ['id', 'assessment_type', 'risk_score', 'risk_category', 'assessment_date']
        });

        // Get latest for each type
        const summary = {};
        assessments.forEach(assessment => {
            if (!summary[assessment.assessment_type] || 
                new Date(assessment.assessment_date) > new Date(summary[assessment.assessment_type].assessment_date)) {
                summary[assessment.assessment_type] = {
                    id: assessment.id,
                    risk_score: assessment.risk_score,
                    risk_category: assessment.risk_category,
                    assessment_date: assessment.assessment_date
                };
            }
        });

        res.json({
            message: 'Risk summary retrieved successfully',
            summary
        });
    } catch (error) {
        console.error('Error fetching risk summary:', error);
        res.status(500).json({ message: 'Error fetching risk summary', error: error.message });
    }
};

// Get patients by risk level (for population health)
exports.getPatientsByRiskLevel = async (req, res) => {
    try {
        const { institution_id, assessment_type, risk_category } = req.query;

        const where = {
            is_active: true,
            assessment_type: assessment_type || 'cardiovascular'
        };

        if (institution_id) where.institution_id = institution_id;
        if (risk_category) where.risk_category = risk_category;

        const assessments = await PatientRiskAssessment.findAll({
            where,
            include: [{
                model: Patient,
                as: 'patient',
                attributes: ['id', 'first_name', 'last_name', 'folder_number', 'date_of_birth', 'gender']
            }],
            order: [['risk_score', 'DESC']]
        });

        res.json({
            message: 'Patients by risk level retrieved successfully',
            assessments,
            count: assessments.length
        });
    } catch (error) {
        console.error('Error fetching patients by risk level:', error);
        res.status(500).json({ message: 'Error fetching patients by risk level', error: error.message });
    }
};

// Helper function to generate recommendations
function generateRecommendations(assessmentType, riskResult) {
    let recommendations = '';

    switch (assessmentType) {
        case 'cardiovascular':
            if (riskResult.risk_category === 'low') {
                recommendations = '• Maintain healthy lifestyle\n• Regular exercise (150 min/week)\n• Healthy diet\n• Annual check-ups';
            } else if (riskResult.risk_category === 'moderate') {
                recommendations = '• Lifestyle modifications\n• Diet changes (reduce salt, fat)\n• Increase physical activity\n• Monitor BP regularly\n• Consider aspirin therapy';
            } else if (riskResult.risk_category === 'high' || riskResult.risk_category === 'very_high') {
                recommendations = '• URGENT: Consult cardiologist\n• Start BP medication if prescribed\n• Strict diet control\n• Daily exercise\n• Stop smoking immediately\n• Limit alcohol\n• Regular follow-up every 3 months';
            }
            break;

        case 'diabetes':
            if (riskResult.risk_category === 'low') {
                recommendations = '• Maintain healthy weight\n• Regular physical activity\n• Balanced diet\n• Annual screening';
            } else if (riskResult.risk_category === 'moderate') {
                recommendations = '• Weight management program\n• Dietary counseling\n• Increase physical activity\n• Screen for pre-diabetes every year';
            } else if (riskResult.risk_category === 'high' || riskResult.risk_category === 'very_high') {
                recommendations = '• URGENT: Glucose testing\n• Consult endocrinologist\n• Lifestyle intervention program\n• Consider metformin if pre-diabetic\n• Monitor blood glucose';
            }
            break;

        case 'fall_risk':
            if (riskResult.risk_category === 'low') {
                recommendations = '• Continue regular activities\n• Home safety awareness';
            } else if (riskResult.risk_category === 'moderate') {
                recommendations = '• Remove home hazards\n• Install grab bars\n• Regular vision check\n• Review medications';
            } else if (riskResult.risk_category === 'high' || riskResult.risk_category === 'very_high') {
                recommendations = '• URGENT: Fall prevention plan\n• Assistive devices recommended\n• Home modification assessment\n• Physical therapy\n• Medication review\n• Frequent monitoring';
            }
            break;
    }

    return recommendations;
}

module.exports = exports;

