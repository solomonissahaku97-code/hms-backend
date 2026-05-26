const express = require('express');
const router = express.Router();
const controller = require('../controllers/consultation/patientAdvancedFeatures.controller');

// SDOH Routes
router.post('/sdoh', controller.createSDOH);
router.get('/sdoh/patient/:patient_id', controller.getPatientSDOH);
router.put('/sdoh/:id', controller.updateSDOH);

// Medication Adherence Routes
router.post('/adherence', controller.createMedicationAdherence);
router.get('/adherence/patient/:patient_id', controller.getPatientAdherence);

// Screening Reminder Routes
router.post('/screenings', controller.createScreeningReminder);
router.get('/screenings/patient/:patient_id', controller.getPatientScreenings);
router.put('/screenings/:id', controller.updateScreeningStatus);
router.get('/screenings/guidelines', controller.getScreeningGuidelines);

// Wellness Score Routes
router.post('/wellness', controller.createWellnessScore);
router.get('/wellness/patient/:patient_id', controller.getPatientWellness);

// Patient Feedback Routes
router.post('/feedback', controller.createFeedback);
router.get('/feedback/patient/:patient_id', controller.getPatientFeedback);
router.put('/feedback/:id/respond', controller.respondToFeedback);

// Organ Donor Routes
router.post('/organ-donor', controller.createOrganDonor);
router.get('/organ-donor/patient/:patient_id', controller.getOrganDonor);
router.put('/organ-donor/:id', controller.updateOrganDonor);

module.exports = router;

