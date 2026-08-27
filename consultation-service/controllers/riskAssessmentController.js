const { PatientRiskAssessment } = require('../models');

exports.createAssessment = async (req, res) => {
  try {
    const { patient_id, assessment_type, input_values, assessed_by } = req.body;
    if (!patient_id || !assessment_type) return res.status(400).json({ error: 'patient_id and assessment_type are required' });

    // Calculate risk score based on type
    let risk_score = 0;
    let risk_category = 'low';
    const risk_factors = [];
    const protective_factors = [];

    if (assessment_type === 'cardiovascular') {
      if (input_values?.smoking) { risk_score += 20; risk_factors.push('Smoking'); }
      if (input_values?.hypertension) { risk_score += 15; risk_factors.push('Hypertension'); }
      if (input_values?.diabetes) { risk_score += 15; risk_factors.push('Diabetes'); }
      if (input_values?.family_history) { risk_score += 10; risk_factors.push('Family history'); }
      if (input_values?.obesity) { risk_score += 10; risk_factors.push('Obesity'); }
      if (input_values?.exercise) { risk_score -= 10; protective_factors.push('Regular exercise'); }
    } else if (assessment_type === 'diabetes') {
      if (input_values?.bmi > 30) { risk_score += 25; risk_factors.push('BMI > 30'); }
      if (input_values?.family_history) { risk_score += 15; risk_factors.push('Family history'); }
      if (input_values?.gestational_diabetes) { risk_score += 20; risk_factors.push('Gestational diabetes'); }
    } else if (assessment_type === 'fall_risk') {
      if (input_values?.age > 65) { risk_score += 20; risk_factors.push('Age > 65'); }
      if (input_values?.history_of_falls) { risk_score += 25; risk_factors.push('History of falls'); }
      if (input_values?.balance_issues) { risk_score += 15; risk_factors.push('Balance issues'); }
    }

    risk_score = Math.max(0, Math.min(100, risk_score));
    if (risk_score >= 60) risk_category = 'high';
    else if (risk_score >= 30) risk_category = 'moderate';

    const next_date = new Date();
    next_date.setMonth(next_date.getMonth() + (risk_category === 'high' ? 6 : 12));

    const assessment = await PatientRiskAssessment.create({
      patient_id, assessment_type, age: req.body.age, gender: req.body.gender,
      risk_score, risk_category, input_values, risk_factors, protective_factors,
      recommendations: generateRecommendations(assessment_type, risk_category),
      next_assessment_date: next_date, status: 'completed', assessed_by, notes: req.body.notes,
      institution_id: req.body.institution_id,
    });

    res.status(201).json({ message: 'Risk assessment completed', data: assessment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create assessment', details: err.message });
  }
};

exports.getPatientAssessments = async (req, res) => {
  try {
    const where = { patient_id: req.params.patient_id };
    if (req.query.assessment_type) where.assessment_type = req.query.assessment_type;
    const assessments = await PatientRiskAssessment.findAll({ where, order: [['assessment_date', 'DESC']] });
    res.json({ data: assessments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assessments', details: err.message });
  }
};

exports.getRiskSummary = async (req, res) => {
  try {
    const assessments = await PatientRiskAssessment.findAll({ where: { patient_id: req.params.patient_id, is_active: true } });
    const summary = {};
    assessments.forEach(a => {
      if (!summary[a.assessment_type] || new Date(a.assessment_date) > new Date(summary[a.assessment_type].assessment_date)) {
        summary[a.assessment_type] = { id: a.id, risk_score: a.risk_score, risk_category: a.risk_category, assessment_date: a.assessment_date };
      }
    });
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary', details: err.message });
  }
};

function generateRecommendations(type, category) {
  if (category === 'low') return 'Maintain healthy lifestyle. Regular check-ups recommended.';
  if (category === 'moderate') return 'Lifestyle modifications recommended. Monitor regularly.';
  return 'URGENT: Consult specialist. Immediate intervention recommended. Regular follow-up required.';
}
