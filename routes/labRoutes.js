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
  updateResultAttachments,
  getResultsByVisitId,
  sendLabResultSMS,
  generateShareLink,
  generateLabResultPDF,
  viewLabResultByToken,
} = require('../controllers/lab/labController');
const authenticateToken = require('../middlewares/authMiddlewares');
const { upload, labAttachmentsUpload, sftpUpload } = require('../middlewares/storage');
const labAnalysisController = require('../controllers/lab/labAnalysisController');
const labStandaloneController = require('../controllers/lab/labStandaloneController');
const instRangeCtrl = require('../controllers/lab/institutionReferenceRangeController');

// Template routes
router.post('/templates',authenticateToken, createTemplate);
router.get('/templates', authenticateToken, getTemplates);
router.get('/analytics', labAnalysisController.getLabAnalytics);


// Result routes
router.post('/results',authenticateToken, createResult);
router.get('/results',authenticateToken, getResults);
// Lab statistics route
router.get('/statistics', authenticateToken, getLabStatistics);


// Lab range routes (system defaults)
router.post('/ranges', authenticateToken, createLabRange);
router.get('/ranges', authenticateToken, getLabRanges);
router.get('/recent-tests', authenticateToken, getRecentLabTests); // recent tests across all visits

// Institution-specific reference range routes
router.get('/institution-ranges', authenticateToken, instRangeCtrl.getInstitutionRanges);
router.get('/institution-ranges/lookup/:testName', authenticateToken, instRangeCtrl.lookupInstitutionRange);
router.get('/institution-ranges/:id', authenticateToken, instRangeCtrl.getInstitutionRange);
router.post('/institution-ranges', authenticateToken, instRangeCtrl.createInstitutionRange);
router.patch('/institution-ranges/:id', authenticateToken, instRangeCtrl.updateInstitutionRange);
router.delete('/institution-ranges/:id', authenticateToken, instRangeCtrl.deleteInstitutionRange);
router.post('/ranges/batch-lookup', authenticateToken, instRangeCtrl.batchLookupRanges);


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
router.get('/results/visit/:visit_id', authenticateToken, getResultsByVisitId);

// Lab result sharing routes (authenticated)
router.post('/results/:id/send-sms', authenticateToken, sendLabResultSMS);
router.post('/results/:id/share-link', authenticateToken, generateShareLink);
router.get('/results/:id/pdf', authenticateToken, generateLabResultPDF);

// Public route: view lab result by secure token (no auth)
router.get('/public/results/:token', viewLabResultByToken);

// Standalone lab routes for lab-only institutions
router.get('/standalone/patients/search', authenticateToken, labStandaloneController.searchPatients);
router.get('/standalone/patient/:id', authenticateToken, labStandaloneController.getPatientDetails);
router.get('/standalone/patient/:id/history', authenticateToken, labStandaloneController.getPatientLabHistory);
router.get('/standalone/records/search', authenticateToken, labStandaloneController.searchVisits);
router.post('/standalone/request', authenticateToken, labStandaloneController.createStandaloneLabRequest);
router.get('/standalone/stats', authenticateToken, labStandaloneController.getStandaloneLabStats);
router.get('/standalone/pending-tests', authenticateToken, labStandaloneController.getStandalonePendingTests);

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