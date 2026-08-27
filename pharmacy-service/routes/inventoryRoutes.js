const express = require('express');
const router = express.Router();
const controller = require('../controllers/inventoryController');
const { authenticateToken } = require('../middlewares/auth');

// Alerts & logs (before parameterized routes)
router.get('/alerts', authenticateToken, controller.getAlerts);
router.get('/logs', authenticateToken, controller.getLogs);
router.get('/valuation', authenticateToken, controller.getValuation);

// Batch CRUD
router.get('/batches', authenticateToken, controller.getBatches);
router.post('/batches', authenticateToken, controller.receiveStock);
router.put('/batches/:id/adjust', authenticateToken, controller.adjustStock);

module.exports = router;
