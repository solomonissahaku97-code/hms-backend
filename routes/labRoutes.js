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
  getRecentLabTests,
  updateResultAttachments
} = require('../controllers/lab/labController');
const authenticateToken = require('../middlewares/authMiddlewares');
const { upload, labAttachmentsUpload } = require('../middlewares/profile_multer');
const labAnalysisController = require('../controllers/lab/labAnalysisController');
const { checkPermission } = require('../middlewares/checkPermission');

// Template routes
router.post('/templates',authenticateToken, checkPermission('manage_lab_results'), createTemplate);
router.get('/templates', authenticateToken, checkPermission('view_lab_results'),getTemplates);
router.get('/analytics', labAnalysisController.getLabAnalytics);


// Result routes
router.post('/results',authenticateToken, checkPermission('request_lab'), createResult);
router.get('/results',authenticateToken, checkPermission('view_lab_results'), getResults);
// Lab statistics route
router.get('/statistics', authenticateToken, checkPermission('view_lab_results'), getLabStatistics);


// Lab range routes
router.post('/ranges', authenticateToken, checkPermission('manage_lab_results'), createLabRange);
router.get('/ranges', authenticateToken, checkPermission('view_lab_results'), getLabRanges);
router.get('/recent-tests', authenticateToken, checkPermission('view_lab_results'), getRecentLabTests); // recent tests across all visits


router.patch('/templates/:id', authenticateToken, checkPermission('manage_lab_results'), updateTemplate);
router.delete('/templates/:id', authenticateToken, checkPermission('manage_lab_results'), deleteTemplate);
router.patch('/results/:id', authenticateToken, checkPermission('manage_lab_results'), updateResult);
// Upload result attachments (images/PDFs) for a lab test result
router.post(
  '/results/:id/attachments',
  authenticateToken,
  checkPermission('manage_lab_results'),
  labAttachmentsUpload.array('attachments', 10),
  updateResultAttachments
);
router.patch('/ranges/:id', authenticateToken, checkPermission('manage_lab_results'), updateLabRange);
router.delete('/ranges/:id', authenticateToken, checkPermission('manage_lab_results'), deleteLabRange);
router.get('/test-stats', authenticateToken, checkPermission('view_lab_results'), getLabTestStats); // stats by department
router.get('/recent-tests/visit/:visit_id', authenticateToken, checkPermission('view_lab_results'), getRecentLabTestsByVisitId); // recent tests by visit ID

// Multer error handler -> clean 400 instead of 500 (e.g. file too large / wrong type)
router.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Maximum size is 10MB.'
      : err.message || 'File upload error';
    return res.status(400).json({ status: 'error', message: msg });
  }
  if (err) {
    return res.status(400).json({ status: 'error', message: err.message || 'Upload failed' });
  }
  next();
});

module.exports = router;