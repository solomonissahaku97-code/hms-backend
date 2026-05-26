const express = require('express');
const router = express.Router();
const controller = require('../controllers/consultation/patientOccupationHistory.controller');

// CREATE
router.post('/', controller.createOccupation);

// GET ALL (optional ?visit_id=uuid)
router.get('/', controller.getAllOccupations);

// GET BY ID
router.get('/:id', controller.getOccupationById);

// UPDATE
router.put('/:id', controller.updateOccupation);

// DELETE (soft delete)
router.delete('/:id', controller.deleteOccupation);

module.exports = router;
