const express = require('express');
const router = express.Router();
const maternityController = require('../controllers/maternity/maternityController');
const authMiddleware = require('../middlewares/authMiddlewares');

// Maternity Dashboard
router.get('/dashboard', authMiddleware, maternityController.getMaternityDashboard);

// ANC Routes
router.get('/anc/patients', authMiddleware, maternityController.getANCPatients);
router.get('/anc/:id', authMiddleware, maternityController.getANCPatient);

// Labour Ward Routes
router.post('/labour/admit', authMiddleware, maternityController.admitToLabour);
router.get('/labour/active', authMiddleware, maternityController.getActiveLabours);

// Delivery Routes
router.post('/delivery', authMiddleware, maternityController.recordDelivery);

module.exports = router;
