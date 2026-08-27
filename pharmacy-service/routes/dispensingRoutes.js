const express = require('express');
const router = express.Router();
const controller = require('../controllers/dispensingController');
const { authenticateToken } = require('../middlewares/auth');

// Stats & history (before action routes)
router.get('/stats', authenticateToken, controller.getStats);
router.get('/history', authenticateToken, controller.getHistory);

// Dispensing actions
router.post('/dispense', authenticateToken, controller.dispense);
router.post('/batch-dispense', authenticateToken, controller.batchDispense);

module.exports = router;
