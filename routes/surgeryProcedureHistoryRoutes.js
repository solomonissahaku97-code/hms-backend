const express = require('express');
const { createSurgeryHistory, getSurgeryHistoriesForPatient, updateSurgeryHistory } = require('../controllers/surgeryProcedureHistoryController');
const router = express.Router();

// Create a new surgery/procedure history for a patient
router.post('/create', createSurgeryHistory);

// Get all surgery/procedure history for a specific patient
router.get('/:patient_id', getSurgeryHistoriesForPatient);

// Update a specific surgery/procedure history
router.put('/:surgeryHistoryId', updateSurgeryHistory);

module.exports = router;
