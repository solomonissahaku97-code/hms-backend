const express = require('express');
const router = express.Router();
const admissionController = require('../controllers/consultation/admissionController')
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')


router.post('/create-new-admission', eitherAuthOrAdmin, admissionController.createAdmission);

// GET ALL ADMISSIONS IN A DEPARTMENT
router.get('/institution/department/all-admissions', eitherAuthOrAdmin, admissionController.getAllAdmissions)
// discharge admission
router.post('/institution/admission/discharge', eitherAuthOrAdmin, admissionController.dischargePatient)

// discharged patient
router.post('/institution/discharge', eitherAuthOrAdmin, admissionController.dischargePatient)

// update admission status
router.put('/update-admission-status', eitherAuthOrAdmin, admissionController.updateAdmissionStatus);



module.exports = router;
