const express = require('express');
const router = express.Router();
const patientCarePlanController = require('../controllers/patientCarePlanController');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')

// Route to get Care Plan by patient_id and institution_id
router.get('',eitherAuthOrAdmin, patientCarePlanController.getCarePlanByPatientAndInstitution);

// Route to create a new Care Plan
router.post('/create',eitherAuthOrAdmin, patientCarePlanController.createCarePlan);

// Route to delete a Care Plan by its ID
router.delete('/:carePlanId',eitherAuthOrAdmin, patientCarePlanController.deleteCarePlan);

// Route to mark a goal as completed in the Care Plan
router.patch('/:carePlanId/goals/:goalIndex',eitherAuthOrAdmin, patientCarePlanController.markGoalAsCompleted);

module.exports = router;
