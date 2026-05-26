const express = require('express');
const router = express.Router();
const fluidMonitoringController = require('../controllers/fluid/fluidMonitoringController');
const authenticateToken = require('../middlewares/authMiddlewares');

// All routes are protected
router.use(authenticateToken);

// Fluid entries
router.get('/entries', fluidMonitoringController.getFluidEntries);
router.post('/entries', fluidMonitoringController.addFluidEntry);


// Fluid balance summary
router.get('/summary', fluidMonitoringController.getFluidBalanceSummary);

// Settings
router.get('/settings', fluidMonitoringController.getFluidSettings);
router.put('/settings', fluidMonitoringController.updateFluidSettings);


router.put('/entries/:id', fluidMonitoringController.updateFluidEntry);
router.delete('/entries/:id', fluidMonitoringController.deleteFluidEntry);

module.exports = router;