const express = require('express');
const router = express.Router();
const { authenticatePatient } = require('../middleware/auth');
const portal = require('../controllers/patientPortalController');

// All routes require patient authentication
router.use(authenticatePatient);

// ── Profile ────────────────────────────────────────────────
router.get('/me/profile', portal.getProfile);

// ── Visits ─────────────────────────────────────────────────
router.get('/me/visits', portal.getVisits);
router.get('/me/visits/:id', portal.getVisitById);

// ── Prescriptions ──────────────────────────────────────────
router.get('/me/prescriptions', portal.getPrescriptions);

// ── Lab Results ────────────────────────────────────────────
router.get('/me/lab-results', portal.getLabResults);

// ── Diagnoses ──────────────────────────────────────────────
router.get('/me/diagnoses', portal.getDiagnoses);

// ── Appointments ───────────────────────────────────────────
router.get('/me/appointments', portal.getAppointments);

// ── Billing ────────────────────────────────────────────────
router.get('/me/billing', portal.getBilling);

module.exports = router;
