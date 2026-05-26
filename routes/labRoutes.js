// routes/labRoutes.js
const express = require('express');
const router = express.Router();
const {
  createTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,
  createResult,
  getResults,
  updateResult,
  getLabStatistics,
  createLabRange,
  getLabRanges,
  updateLabRange,
  deleteLabRange,
  getLabTestStats,
  getRecentLabTestsByVisitId,
  getRecentLabTests
} = require('../controllers/lab/labController');
const authenticateToken = require('../middlewares/authMiddlewares');
const labAnalysisController = require('../controllers/lab/labAnalysisController');



// Template routes
router.post('/templates',authenticateToken, createTemplate);
router.get('/templates', authenticateToken,getTemplates);
router.get('/analytics', labAnalysisController.getLabAnalytics);


// Result routes
router.post('/results',authenticateToken, createResult);
router.get('/results',authenticateToken, getResults);
// Lab statistics route
router.get('/statistics', authenticateToken, getLabStatistics);


// Lab range routes
router.post('/ranges', authenticateToken, createLabRange);
router.get('/ranges', authenticateToken, getLabRanges);
router.get('/recent-tests', authenticateToken, getRecentLabTests); // recent tests across all visits


router.patch('/templates/:id', authenticateToken, updateTemplate);
router.delete('/templates/:id', authenticateToken, deleteTemplate);
router.patch('/results/:id', authenticateToken, updateResult);
router.patch('/ranges/:id', authenticateToken, updateLabRange);
router.delete('/ranges/:id', authenticateToken, deleteLabRange);
router.get('/test-stats', authenticateToken, getLabTestStats); // stats by department
router.get('/recent-tests/visit/:visit_id', authenticateToken, getRecentLabTestsByVisitId); // recent tests by visit ID

module.exports = router;