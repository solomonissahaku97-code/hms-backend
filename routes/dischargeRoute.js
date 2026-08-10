const express = require('express');
const router = express.Router();
const dischargeController = require('../controllers/admission/discharge_controller');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware');

// Create a discharge record
router.post('/', eitherAuthOrAdmin, dischargeController.createDischarge);

// Get all discharges with optional filters
router.get('/', eitherAuthOrAdmin, dischargeController.getAllDischarges);

// Get single discharge
router.get('/:id', eitherAuthOrAdmin, dischargeController.getDischargeById);

// Update discharge
router.put('/:id', eitherAuthOrAdmin, dischargeController.updateDischarge);

// Cancel discharge
router.delete('/:id', eitherAuthOrAdmin, dischargeController.deleteDischarge);

// Get statistics 
router.get('/stats', eitherAuthOrAdmin, dischargeController.getDischargeStats);

module.exports = router;