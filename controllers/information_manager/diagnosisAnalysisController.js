// controllers/diagnosisAnalysisController.js
const DiagnosisService = require('../../service/diagnosisService');

exports.getDiagnosisAnalysis = async (req, res) => {
  try {
    const [topDiseases, genderDistribution, statusSummary] = await Promise.all([
      DiagnosisService.getTopDiseases(),
      DiagnosisService.getGenderDistribution(),
      DiagnosisService.getStatusSummary()
    ]);

    res.json({
      topDiseases,
      genderDistribution,
      statusSummary
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error generating diagnosis analysis' });
  }
};
