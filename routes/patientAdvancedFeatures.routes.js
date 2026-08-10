const express = require('express');
const router = express.Router();
const controller = require('../controllers/consultation/patientAdvancedFeatures.controller');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware');

// SDOH Routes
router.post('/sdoh', eitherAuthOrAdmin, controller.createSDOH);
router.get('/sdoh/patient/:patient_id', eitherAuthOrAdmin, controller.getPatientSDOH);
router.put('/sdoh/:id', eitherAuthOrAdmin, controller.updateSDOH);

// Medication Adherence Routes
router.post('/adherence', eitherAuthOrAdmin, controller.createMedicationAdherence);
router.get('/adherence/patient/:patient_id', eitherAuthOrAdmin, controller.getPatientAdherence);

// Screening Reminder Routes
router.post('/screenings', eitherAuthOrAdmin, controller.createScreeningReminder);
router.get('/screenings/patient/:patient_id', eitherAuthOrAdmin, controller.getPatientScreenings);
router.put('/screenings/:id', eitherAuthOrAdmin, controller.updateScreeningStatus);
router.get('/screenings/guidelines', eitherAuthOrAdmin, controller.getScreeningGuidelines);

// Wellness Score Routes
router.post('/wellness', eitherAuthOrAdmin, controller.createWellnessScore);
router.get('/wellness/patient/:patient_id', eitherAuthOrAdmin, controller.getPatientWellness);

// Patient Feedback Routes
router.post('/feedback', eitherAuthOrAdmin, controller.createFeedback);
router.get('/feedback/patient/:patient_id', eitherAuthOrAdmin, controller.getPatientFeedback);
router.put('/feedback/:id/respond', eitherAuthOrAdmin, controller.respondToFeedback);

// Organ Donor Routes
router.post('/organ-donor', eitherAuthOrAdmin, controller.createOrganDonor);
router.get('/organ-donor/patient/:patient_id', eitherAuthOrAdmin, controller.getOrganDonor);
router.put('/organ-donor/:id', eitherAuthOrAdmin, controller.updateOrganDonor);

module.exports = router;

