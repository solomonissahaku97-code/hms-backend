// services/diagnosisService.js
const { fn, col } = require('sequelize');
const Diagnosis = require('../models/diagnosis');
const systemDiagnosis = require('../models/claims/systemDiagnosis');
const Patient = require('../models/patient');

class DiagnosisService {
  // Fetch top diseases
  static async getTopDiseases(limit = 5) {
    const data = await Diagnosis.findAll({
      attributes: [
        [fn('COUNT', col('Diagnosis.id')), 'count'],
        [col('systemDiagnosis.diagnosis_name'), 'disease']
      ],
      include: [{ model: systemDiagnosis, as: 'systemDiagnosis', attributes: [] }],
      group: ['systemDiagnosis.id'],
      order: [[fn('COUNT', col('Diagnosis.id')), 'DESC']],
      limit
    });

    const total = data.reduce((sum, row) => sum + parseInt(row.get('count')), 0);

    // Interpretation
    const interpretation = data.map(row => {
      const disease = row.get('disease');
      const count = parseInt(row.get('count'));
      const percentage = ((count / total) * 100).toFixed(1);

      return {
        disease,
        count,
        percentage: `${percentage}%`,
        insight: `${disease} accounts for ${percentage}% of all diagnoses.`
      };
    });

    return { data, interpretation };
  }

  // Gender distribution analysis
  static async getGenderDistribution() {
    const data = await Diagnosis.findAll({
      attributes: [
        [fn('COUNT', col('Diagnosis.id')), 'count'],
        [col('diagnosis.gender'), 'gender']
      ],
      include: [{ model: Patient, as: 'diagnosis', attributes: [] }],
      group: ['diagnosis.gender']
    });

    const total = data.reduce((sum, row) => sum + parseInt(row.get('count')), 0);

    const interpretation = data.map(row => {
      const gender = row.get('gender');
      const count = parseInt(row.get('count'));
      const percentage = ((count / total) * 100).toFixed(1);

      return {
        gender,
        count,
        percentage: `${percentage}%`,
        insight: `${gender} patients represent ${percentage}% of all diagnosed cases.`
      };
    });

    return { data, interpretation };
  }

  // Diagnosis status summary
  static async getStatusSummary() {
    const data = await Diagnosis.findAll({
      attributes: ['status', [fn('COUNT', col('Diagnosis.id')), 'count']],
      group: ['status']
    });

    const total = data.reduce((sum, row) => sum + parseInt(row.get('count')), 0);

    const interpretation = data.map(row => {
      const status = row.get('status');
      const count = parseInt(row.get('count'));
      const percentage = ((count / total) * 100).toFixed(1);

      return {
        status,
        count,
        percentage: `${percentage}%`,
        insight: `${status} cases make up ${percentage}% of diagnoses.`
      };
    });

    return { data, interpretation };
  }
}

module.exports = DiagnosisService;
