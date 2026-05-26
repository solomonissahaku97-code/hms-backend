const express = require('express');
const router = express.Router();
const controller = require('../controllers/consultation/pastMedicalHistory.controller');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware');

// CREATE
router.post('/', eitherAuthOrAdmin, controller.createPastMedicalHistory);

// GET ALL (optional ?visit_id=uuid)
router.get('/', eitherAuthOrAdmin, controller.getAllPastMedicalHistories);

// GET BY ID
router.get('/:id', eitherAuthOrAdmin, controller.getPastMedicalHistoryById);

// UPDATE
router.put('/:id', eitherAuthOrAdmin, controller.updatePastMedicalHistory);

// DELETE (soft delete)
router.delete('/:id', eitherAuthOrAdmin, controller.deletePastMedicalHistory);

module.exports = router;

