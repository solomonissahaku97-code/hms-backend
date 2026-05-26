const express = require('express');
const router = express.Router();
const allergyController = require('../controllers/consultation/patientAllergy.controller');

// CRUD routes
router.post('/', allergyController.createAllergy);
router.get('/patient/:patient_id', allergyController.getPatientAllergies);
router.get('/summary/:patient_id', allergyController.getAllergySummary);
router.get('/check-drug', allergyController.checkDrugAllergies);
router.get('/:id', allergyController.getAllergyById);
router.put('/:id', allergyController.updateAllergy);
router.delete('/:id', allergyController.deleteAllergy);
router.patch('/verify/:id', allergyController.verifyAllergy);

module.exports = router;

