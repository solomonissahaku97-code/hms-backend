const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const consultation = require('../controllers/consultationController');
const diagnosis = require('../controllers/diagnosisController');
const prescription = require('../controllers/prescriptionController');
const allergy = require('../controllers/allergyController');
const chronicCondition = require('../controllers/chronicConditionController');
const familyHistory = require('../controllers/familyHistoryController');
const riskAssessment = require('../controllers/riskAssessmentController');
const drugHistory = require('../controllers/drugHistoryController');
const patientHistory = require('../controllers/patientHistoryController');

// ── Consultations ───────────────────────────────────────────────
router.post('/consultations', authenticate, consultation.requestConsultation);
router.get('/consultations', authenticate, consultation.getAllConsultations);
router.put('/consultations/:id/approve', authenticate, consultation.approveConsultation);
router.delete('/consultations/:id', authenticate, consultation.rejectConsultation);

// ── Diagnoses ───────────────────────────────────────────────────
router.post('/diagnoses', authenticate, diagnosis.addDiagnosis);
router.get('/diagnoses', authenticate, diagnosis.getPatientDiagnoses);
router.put('/diagnoses/:id', authenticate, diagnosis.updateDiagnosis);
router.delete('/diagnoses/:id', authenticate, diagnosis.deleteDiagnosis);

// ── Prescriptions ───────────────────────────────────────────────
router.post('/prescriptions', authenticate, prescription.createPrescription);
router.get('/prescriptions', authenticate, prescription.getAllPrescriptions);
router.get('/prescriptions/:id', authenticate, prescription.getPrescriptionById);
router.put('/prescriptions/:id', authenticate, prescription.updatePrescription);
router.put('/prescriptions/:id/dispense', authenticate, prescription.dispensePrescription);
router.put('/prescriptions/:id/cancel', authenticate, prescription.cancelPrescription);
router.delete('/prescriptions/:id', authenticate, prescription.deletePrescription);

// ── Allergies ───────────────────────────────────────────────────
router.post('/allergies', authenticate, allergy.createAllergy);
router.get('/allergies/patient/:patient_id', authenticate, allergy.getPatientAllergies);
router.get('/allergies/summary/:patient_id', authenticate, allergy.getAllergySummary);
router.get('/allergies/check', authenticate, allergy.checkDrugAllergies);
router.put('/allergies/:id', authenticate, allergy.updateAllergy);
router.delete('/allergies/:id', authenticate, allergy.deleteAllergy);

// ── Chronic Conditions ──────────────────────────────────────────
router.post('/conditions', authenticate, chronicCondition.createCondition);
router.get('/conditions/patient/:patient_id', authenticate, chronicCondition.getPatientConditions);
router.get('/conditions/summary/:patient_id', authenticate, chronicCondition.getConditionSummary);
router.get('/conditions/follow-ups', authenticate, chronicCondition.getPatientsDueForFollowUp);
router.put('/conditions/:id', authenticate, chronicCondition.updateCondition);
router.delete('/conditions/:id', authenticate, chronicCondition.deleteCondition);

// ── Family Health History ───────────────────────────────────────
router.post('/family-history', authenticate, familyHistory.createFamilyHistory);
router.get('/family-history/patient/:patient_id', authenticate, familyHistory.getPatientFamilyHistory);
router.get('/family-history/summary/:patient_id', authenticate, familyHistory.getFamilyHistorySummary);
router.put('/family-history/:id', authenticate, familyHistory.updateFamilyHistory);
router.delete('/family-history/:id', authenticate, familyHistory.deleteFamilyHistory);

// ── Risk Assessments ────────────────────────────────────────────
router.post('/risk-assessments', authenticate, riskAssessment.createAssessment);
router.get('/risk-assessments/patient/:patient_id', authenticate, riskAssessment.getPatientAssessments);
router.get('/risk-assessments/summary/:patient_id', authenticate, riskAssessment.getRiskSummary);

// ── Drug History ────────────────────────────────────────────────
router.post('/drug-history', authenticate, drugHistory.create);
router.get('/drug-history', authenticate, drugHistory.getAll);
router.get('/drug-history/:id', authenticate, drugHistory.getById);
router.put('/drug-history/:id', authenticate, drugHistory.update);
router.delete('/drug-history/:id', authenticate, drugHistory.remove);

// ── Past Medical History ────────────────────────────────────────
router.post('/medical-history', authenticate, patientHistory.createPastMedicalHistory);
router.get('/medical-history', authenticate, patientHistory.getPastMedicalHistories);
router.put('/medical-history/:id', authenticate, patientHistory.updatePastMedicalHistory);
router.delete('/medical-history/:id', authenticate, patientHistory.deletePastMedicalHistory);

// ── Occupation History ──────────────────────────────────────────
router.post('/occupation-history', authenticate, patientHistory.createOccupation);
router.get('/occupation-history', authenticate, patientHistory.getOccupations);
router.put('/occupation-history/:id', authenticate, patientHistory.updateOccupation);
router.delete('/occupation-history/:id', authenticate, patientHistory.deleteOccupation);

module.exports = router;
