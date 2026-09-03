const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const reg = require('../controllers/registrationController');
const patientAuth = require('../controllers/patientAuthController');
const { authenticateToken } = require('../middleware/auth');

// Health
router.get('/health', auth.health);

// Login
router.post('/login', auth.staffLogin);
router.post('/verify-logic', auth.verifyLogicAnswer);
router.post('/admin/login', auth.adminLogin);

// ── Unified Login (same handlers, /unified prefix for frontend compat) ──
router.post('/unified/login', auth.unifiedLogin);
router.post('/unified/verify-logic', auth.verifyLogicAnswer);

// ── Patient Login (public) ──
router.post('/login/patient', patientAuth.patientLogin);

// Token
router.get('/verify', authenticateToken, auth.verifyToken);

// User
router.get('/user/:id', authenticateToken, auth.getUserById);

// Password
router.post('/reset-password', authenticateToken, auth.resetPassword);

// ── Patient Password Management ──
router.put('/patient/password', authenticateToken, patientAuth.changePassword);
router.post('/patient/password/reset-request', patientAuth.requestPasswordReset);
router.post('/patient/password/reset-verify', patientAuth.verifyResetOTP);

// ── Registration (public, no auth required) ──
router.get('/register/subscription-plans', reg.getSubscriptionPlans);
router.get('/register/check-email', reg.checkEmailAvailability);
router.post('/register/institution', reg.registerInstitution);
router.post('/register/admin', reg.registerAdmin);

module.exports = router;
