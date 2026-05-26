const express = require('express');
const router = express.Router();
const patientDiagnosisController = require('../controllers/consultation/patientDiagnosisController');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')


// GET ALL DIAGNOSIS

router.get('/patient/get-diagnosis',eitherAuthOrAdmin,patientDiagnosisController.getPatientDiagnosis)


// Create a new patient diagnosis
router.post('/patient-diagnoses/add-diagnosis',eitherAuthOrAdmin, patientDiagnosisController.addDiagnosis);

router.delete('/patient-diagnosis/:id',eitherAuthOrAdmin,patientDiagnosisController.deleteDiagnosis)
// update diagnoses for a patient



module.exports = router;
