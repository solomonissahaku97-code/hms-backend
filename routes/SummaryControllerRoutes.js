const express = require('express');
const StoreSummaryController = require('../controllers/StoreSummaryController');
const router = express.Router();

// router.get('/summary', getSystemSummary);
router.get('/summary/store-summary', StoreSummaryController.getSummary);
module.exports = router;
 