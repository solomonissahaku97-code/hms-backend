const express = require('express');
const router = express.Router();
const familyHistoryController = require('../controllers/consultation/familyHealthHistory.controller');

// CRUD routes
router.post('/', familyHistoryController.createFamilyHistory);
router.get('/patient/:patient_id', familyHistoryController.getPatientFamilyHistory);
router.get('/summary/:patient_id', familyHistoryController.getFamilyHistorySummary);
router.get('/common-conditions', familyHistoryController.getCommonConditions);
router.get('/:id', familyHistoryController.getFamilyHistoryById);
router.put('/:id', familyHistoryController.updateFamilyHistory);
router.delete('/:id', familyHistoryController.deleteFamilyHistory);

module.exports = router;

