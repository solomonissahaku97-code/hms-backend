const express = require('express');
const router = express.Router();
const riskAssessmentController = require('../controllers/consultation/patientRiskAssessment.controller');

// CRUD routes
router.post('/', riskAssessmentController.createRiskAssessment);
router.get('/patient/:patient_id', riskAssessmentController.getPatientRiskAssessments);
router.get('/patient/:patient_id/latest/:assessment_type', riskAssessmentController.getLatestRiskAssessment);
router.get('/summary/:patient_id', riskAssessmentController.getRiskSummary);
router.get('/by-risk', riskAssessmentController.getPatientsByRiskLevel);
router.get('/:id', riskAssessmentController.getRiskAssessmentById);
router.put('/:id', riskAssessmentController.updateRiskAssessment);
router.delete('/:id', riskAssessmentController.deleteRiskAssessment);

module.exports = router;

