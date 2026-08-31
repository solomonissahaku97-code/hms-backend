const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subscriptionController');
const { authenticateToken, authenticateService } = require('../middleware/auth');

// Health
router.get('/health', ctrl.health);

// ── Plans (public read, admin write) ──
router.get('/plans', ctrl.getPlans);
router.get('/plans/:id', ctrl.getPlan);
router.post('/plans', authenticateToken, ctrl.createPlan);
router.put('/plans/:id', authenticateToken, ctrl.updatePlan);
router.delete('/plans/:id', authenticateToken, ctrl.deletePlan);

// ── Institution Subscriptions ──
router.get('/institution/:institution_id', authenticateToken, ctrl.getInstitutionSubscription);
router.post('/assign', authenticateToken, ctrl.assignSubscription);
router.post('/renew', authenticateToken, ctrl.renewSubscription);

// ── Admin / Super Admin ──
router.get('/all', authenticateToken, ctrl.getAllSubscriptions);
router.get('/dashboard/stats', authenticateToken, ctrl.getDashboardStats);

module.exports = router;
