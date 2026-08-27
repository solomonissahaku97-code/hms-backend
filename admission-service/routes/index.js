const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const admissionCtrl = require('../controllers/admissionController');
const bedCtrl = require('../controllers/bedController');
const dischargeCtrl = require('../controllers/dischargeController');

// ── Admissions ──────────────────────────────────────────────────
router.post('/admissions', authenticateToken, admissionCtrl.createAdmission);
router.get('/admissions', authenticateToken, admissionCtrl.getAllAdmissions);
router.get('/admissions/:id', authenticateToken, admissionCtrl.getAdmissionById);
router.put('/admissions/discharge', authenticateToken, admissionCtrl.dischargePatient);
router.put('/admissions/status', authenticateToken, admissionCtrl.updateAdmissionStatus);
router.put('/admissions/transfer', authenticateToken, admissionCtrl.transferPatient);
router.get('/admissions/dashboard/stats', authenticateToken, admissionCtrl.getDashboardStats);

// ── Beds ────────────────────────────────────────────────────────
router.get('/beds', authenticateToken, bedCtrl.getAllBeds);
router.post('/beds', authenticateToken, bedCtrl.addBeds);
router.put('/beds/status', authenticateToken, bedCtrl.updateBedStatus);
router.delete('/beds/:id', authenticateToken, bedCtrl.deleteBed);
router.get('/beds/summary', authenticateToken, bedCtrl.getBedsSummary);

// ── Discharges ──────────────────────────────────────────────────
router.post('/discharges', authenticateToken, dischargeCtrl.createDischarge);
router.get('/discharges', authenticateToken, dischargeCtrl.getAllDischarges);
router.get('/discharges/:id', authenticateToken, dischargeCtrl.getDischargeById);
router.get('/discharges/stats', authenticateToken, dischargeCtrl.getDischargeStats);
router.get('/discharges/deceased', authenticateToken, dischargeCtrl.getDeceasedPatients);

module.exports = router;
