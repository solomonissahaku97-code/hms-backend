const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/pharmacy/Prescription');
const authenticateToken = require('../middlewares/authMiddlewares');

// STATISTICS ROUTE - MUST COME BEFORE DYNAMIC ROUTES
router.get('/statistics', authenticateToken, prescriptionController.getPharmacyDashboardStats);
// get dispense history
router.get('/dispense/history', authenticateToken, prescriptionController.getDispenseHistory);

// CRUD routes
router.post('/', authenticateToken, prescriptionController.createPrescription);
// router.post('/',authenticateToken,prescriptionController.create)
router.get('/', authenticateToken, prescriptionController.getAllPrescriptions);
router.get('/visit/:visitId', authenticateToken, prescriptionController.getPrescriptionsByVisit);

// ID-BASED ROUTES - MUST COME LAST
router.get('/:id', authenticateToken, prescriptionController.getPrescriptionById);
router.put('/:id', authenticateToken, prescriptionController.updatePrescription);
router.delete('/:id', authenticateToken, prescriptionController.deletePrescription);
router.put('/:id/status', authenticateToken, prescriptionController.updatePrescriptionStatus);

module.exports = router;
