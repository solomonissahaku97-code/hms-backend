const express = require('express');
const router = express.Router();
const wardsController = require('../controllers/wardsController');
const authenticateToken = require('../middlewares/authMiddlewares');

router.get('/:institutionId/departments/:departmentId/patients',authenticateToken, wardsController.getAllPatientsInDepartment);

router.get('/:institutionId/departments/:departmentId/patients/:patientId',authenticateToken, wardsController.getPatientDetails);

// Assign nurse to patient
router.post('/assign-nurse',authenticateToken, wardsController.assignNurseToPatient);

// get all nurse assignments by department
router.get('/:institutionId/departments/:departmentId/assignments',authenticateToken, wardsController.getNurseAssignmentsByDepartment);

// release nurse assignment
router.put('/release-assignment/:assignmentId',authenticateToken, wardsController.releaseNurseFromPatient);

module.exports = router;
