const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const reg = require('../controllers/registrationController');
const { authenticateToken } = require('../middleware/auth');

// Health
router.get('/health', auth.health);

// Login
router.post('/login', auth.staffLogin);
router.post('/verify-logic', auth.verifyLogicAnswer);
router.post('/admin/login', auth.adminLogin);

// Token
router.get('/verify', authenticateToken, auth.verifyToken);

// User
router.get('/user/:id', authenticateToken, auth.getUserById);

// Password
router.post('/reset-password', authenticateToken, auth.resetPassword);

// ── Registration (public, no auth required) ──
router.get('/register/subscription-plans', reg.getSubscriptionPlans);
router.get('/register/check-email', reg.checkEmailAvailability);
router.post('/register/institution', reg.registerInstitution);
router.post('/register/admin', reg.registerAdmin);

module.exports = router;
