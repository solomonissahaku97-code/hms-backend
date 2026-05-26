const express = require('express');
const router = express.Router();
const dischargeController = require('../controllers/admission/discharge_controller');

// Create a discharge record
router.post('/', dischargeController.createDischarge);

// Get all discharges with optional filters
router.get('/', dischargeController.getAllDischarges);

// Get single discharge
router.get('/:id', dischargeController.getDischargeById);

// Update discharge
router.put('/:id', dischargeController.updateDischarge);

// Cancel discharge
router.delete('/:id', dischargeController.deleteDischarge);

// Get statistics 
router.get('/stats', dischargeController.getDischargeStats);

module.exports = router;