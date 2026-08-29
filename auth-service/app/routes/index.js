const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
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

module.exports = router;
