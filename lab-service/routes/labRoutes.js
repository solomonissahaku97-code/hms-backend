/**
 * Lab Service — Routes
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const labController = require('../controllers/labController');

// All routes require authentication
router.use(authenticate);

// ── Templates ──────────────────────────────────────────────────────
router.post('/templates', labController.createTemplate);
router.get('/templates', labController.getTemplates);
router.patch('/templates/:id', labController.updateTemplate);
router.delete('/templates/:id', labController.deleteTemplate);

// ── Results ────────────────────────────────────────────────────────
router.get('/results', labController.getResults);
router.get('/results/pending', labController.getPendingLabTests);
router.get('/results/visit/:visit_id', labController.getResultsByVisitId);
router.get('/results/recent', labController.getRecentLabTests);
router.get('/results/recent/visit/:visit_id', labController.getRecentLabTestsByVisitId);

// ── Ranges ─────────────────────────────────────────────────────────
router.post('/ranges', labController.createLabRange);
router.get('/ranges', labController.getLabRanges);
router.patch('/ranges/:id', labController.updateLabRange);
router.delete('/ranges/:id', labController.deleteLabRange);

// ── Institution Ranges ─────────────────────────────────────────────
router.get('/institution-ranges', labController.getInstitutionRanges);
router.post('/institution-ranges', labController.createInstitutionRange);
router.patch('/institution-ranges/:id', labController.updateInstitutionRange);
router.delete('/institution-ranges/:id', labController.deleteInstitutionRange);
router.get('/institution-ranges/lookup/:testName', labController.lookupInstitutionRange);
router.post('/institution-ranges/batch-lookup', labController.batchLookupRanges);

// ── Statistics ─────────────────────────────────────────────────────
router.get('/statistics', labController.getLabStatistics);
router.get('/test-stats', labController.getLabTestStats);

// ── Lab Investigations (Tariffs) ───────────────────────────────────
router.post('/investigations', labController.createInvestigation);
router.get('/investigations', labController.getInvestigations);
router.get('/investigations/search', labController.searchInvestigations);
router.get('/investigations/:id', labController.getInvestigation);
router.put('/investigations/:id', labController.updateInvestigation);
router.delete('/investigations/:id', labController.deleteInvestigation);

// ── Patient Labs ───────────────────────────────────────────────────
router.get('/patient-labs', labController.getPatientLabs);

// ── Sharing ────────────────────────────────────────────────────────
router.post('/results/:id/share-link', labController.generateShareLink);
router.post('/results/:id/send-sms', labController.sendLabResultSMS);

// Public route: view by token (no auth)
router.get('/public/results/:token', labController.viewLabResultByToken);

module.exports = router;
