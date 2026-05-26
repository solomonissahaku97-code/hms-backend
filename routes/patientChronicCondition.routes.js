const express = require('express');
const router = express.Router();
const chronicConditionController = require('../controllers/consultation/patientChronicCondition.controller');

// CRUD routes
router.post('/', chronicConditionController.createChronicCondition);
router.get('/patient/:patient_id', chronicConditionController.getPatientChronicConditions);
router.get('/summary/:patient_id', chronicConditionController.getChronicConditionSummary);
router.get('/due-followup', chronicConditionController.getPatientsDueForFollowUp);
router.get('/common', chronicConditionController.getCommonConditions);
router.get('/category/:category', chronicConditionController.getConditionsByCategory);
router.get('/:id', chronicConditionController.getChronicConditionById);
router.put('/:id', chronicConditionController.updateChronicCondition);
router.patch('/:id/status', chronicConditionController.updateConditionStatus);
router.delete('/:id', chronicConditionController.deleteChronicCondition);

module.exports = router;

