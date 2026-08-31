const express = require('express');
const router = express.Router();
const controller = require('../controllers/pricingController');
const { authenticateToken } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

// List all institution prices
router.get('/', controller.getAll);

// Resolve effective price for a medication
router.get('/resolve', controller.resolvePrice);

// Get price for a specific medication
router.get('/medication/:medicine_id', controller.getByMedication);

// Set price (create or update)
router.post('/', controller.setPrice);

// Batch set prices
router.post('/batch', controller.batchSetPrices);

// Delete price
router.delete('/:id', controller.deletePrice);

module.exports = router;
