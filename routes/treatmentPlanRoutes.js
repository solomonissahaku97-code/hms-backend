const express = require('express');
const router = express.Router();
const treatmentPlanController = require('../controllers/treatmentPlanController');

// Route to create a new treatment plan
router.post('/', treatmentPlanController.createTreatmentPlan);

// Route to get a specific treatment plan by ID
router.get('/:id', treatmentPlanController.getTreatmentPlanById);

// Route to update a treatment plan
router.put('/:id', treatmentPlanController.updateTreatmentPlan);

// Route to delete a treatment plan
router.delete('/:id', treatmentPlanController.deleteTreatmentPlan);

// Route to get all treatment plans for a specific patient
router.get('/patient/:patient_id', treatmentPlanController.getTreatmentPlansByPatientId);

module.exports = router;
