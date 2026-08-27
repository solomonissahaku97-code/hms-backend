const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboardController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/overview', authenticateToken, controller.getOverview);
router.get('/revenue', authenticateToken, controller.getRevenue);
router.get('/activity', authenticateToken, controller.getActivity);

module.exports = router;
