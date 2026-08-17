const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralsController');
const authenticateToken = require('../middlewares/authMiddlewares');

// Search laboratories
router.get('/search-labs', authenticateToken, referralController.searchLabs);

// Create referral
router.post('/', authenticateToken, referralController.createReferral);

// Get my sent referrals
router.get('/sent', authenticateToken, referralController.getMyReferrals);

// Get incoming referrals
router.get('/incoming', authenticateToken, referralController.getIncomingReferrals);

// Get referral by ID
router.get('/:id', authenticateToken, referralController.getReferralById);

// Accept referral
router.patch('/:id/accept', authenticateToken, referralController.acceptReferral);

// Reject referral
router.patch('/:id/reject', authenticateToken, referralController.rejectReferral);

// Update referral status
router.patch('/:id/status', authenticateToken, referralController.updateReferralStatus);

// Submit results
router.post('/:id/results', authenticateToken, referralController.submitReferralResults);

// Mark as completed (referring institution)
router.patch('/:id/complete', authenticateToken, referralController.completeReferral);

// Cancel referral
router.patch('/:id/cancel', authenticateToken, referralController.cancelReferral);

module.exports = router;
