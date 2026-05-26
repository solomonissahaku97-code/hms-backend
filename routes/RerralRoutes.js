const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralsController');
const adminAuth = require('../middlewares/adminMiddleware')


// Route to get referrals by referrerId
router.get('/referrals/referrer',adminAuth, referralController.getReferralsByReferrerId);

module.exports = router;
