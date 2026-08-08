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
  getPendingLabTests,
  updateResultAttachments
} = require('../controllers/lab/labController');
const authenticateToken = require('../middlewares/authMiddlewares');
const { upload, labAttachmentsUpload, sftpUpload } = require('../middlewares/profile_multer');
const labAnalysisController = require('../controllers/lab/labAnalysisController');

// Template routes
router.post('/templates',authenticateToken, createTemplate);
router.get('/templates', authenticateToken, getTemplates);
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
// Upload result attachments (images/PDFs) for a lab test result
router.post(
  '/results/:id/attachments',
  authenticateToken,
  labAttachmentsUpload.array('attachments', 10),
  sftpUpload('attachments', 'lab-attachments'),
  updateResultAttachments
);
router.patch('/ranges/:id', authenticateToken, updateLabRange);
router.delete('/ranges/:id', authenticateToken, deleteLabRange);
router.get('/test-stats', authenticateToken, getLabTestStats); // stats by department
router.get('/recent-tests/visit/:visit_id', authenticateToken, getRecentLabTestsByVisitId); // recent tests by visit ID
router.get('/results/pending', authenticateToken, getPendingLabTests); // pending tests for Lab department work queue

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