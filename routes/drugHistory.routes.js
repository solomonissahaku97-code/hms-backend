const express = require('express');
const router = express.Router();
const controller = require('../controllers/consultation/drugHistory.controller');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware');

// CREATE
router.post('/', eitherAuthOrAdmin, controller.createDrugHistory);

// GET ALL (optional ?visit_id=uuid)
router.get('/', eitherAuthOrAdmin, controller.getAllDrugHistories);

// GET BY ID
router.get('/:id', eitherAuthOrAdmin, controller.getDrugHistoryById);

// UPDATE
router.put('/:id', eitherAuthOrAdmin, controller.updateDrugHistory);

// DELETE (soft delete)
router.delete('/:id', eitherAuthOrAdmin, controller.deleteDrugHistory);

module.exports = router;

