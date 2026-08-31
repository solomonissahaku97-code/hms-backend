const express = require('express');
const router = express.Router();
const { authenticateService } = require('../middleware/auth');
const ctrl = require('../controllers/networkController');

// All routes require authentication
router.use(authenticateService);

// ── Central Patient Identity ──
router.post('/central-patients', ctrl.createCentralPatient);
router.get('/central-patients/search', ctrl.searchCentralPatients);
router.get('/central-patients/:id', ctrl.getCentralPatient);

// ── Patient-Institution Relationships ──
router.post('/relationships', ctrl.createRelationship);
router.get('/relationships/institution/:institutionId', ctrl.getInstitutionPatients);

// ── Patient Transfers ──
router.post('/transfers', ctrl.createTransfer);
router.get('/transfers/incoming', ctrl.getIncomingTransfers);
router.get('/transfers/outgoing', ctrl.getOutgoingTransfers);
router.put('/transfers/:id/accept', ctrl.acceptTransfer);
router.put('/transfers/:id/reject', ctrl.rejectTransfer);

// ── Patient Referrals ──
router.post('/referrals', ctrl.createReferral);
router.get('/referrals/incoming', ctrl.getIncomingReferrals);
router.get('/referrals/outgoing', ctrl.getOutgoingReferrals);
router.put('/referrals/:id/accept', ctrl.acceptReferral);
router.put('/referrals/:id/reject', ctrl.rejectReferral);

// ── Cross-Institution Lab Referrals ──
router.post('/lab-referrals', ctrl.createLabReferral);
router.get('/lab-referrals/incoming', ctrl.getIncomingLabReferrals);
router.get('/lab-referrals/outgoing', ctrl.getOutgoingLabReferrals);
router.put('/lab-referrals/:id/accept', ctrl.acceptLabReferral);
router.put('/lab-referrals/:id/complete', ctrl.completeLabReferral);

// ── Shared Clinical Records ──
router.get('/shared-records', ctrl.getSharedRecords);
router.post('/shared-records', ctrl.shareRecord);

// ── Access Control ──
router.get('/access-check', ctrl.checkAccess);

// ── Audit Trail ──
router.get('/audit-trail', ctrl.getAuditTrail);

// ── Statistics ──
router.get('/stats', ctrl.getStats);

module.exports = router;
