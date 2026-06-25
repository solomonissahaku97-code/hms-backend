const express = require('express');
const router = express.Router();
const recordOfficer = require('../controllers/records/recordOfficerController')
const recordsStats = require('../controllers/records/recordStatsController')
const adminAuthOrUserAuth = require('../middlewares/eitherAuthOrAdminMiddleware')
const patientReport = require('../controllers/records/patient_report')


// RECORD OFFICER

// Create a new patient record
router.post('/patient/create',adminAuthOrUserAuth,recordOfficer.createNewPatient);



// initiate patient
router.post('/patient/initiate',adminAuthOrUserAuth,recordOfficer.initializeNewPatientVisit);

// Get all active visits in an institution
router.get('/visit/active',adminAuthOrUserAuth,recordOfficer.getActiveVisits)
router.get('/insurance',adminAuthOrUserAuth,recordOfficer.getAllInsuranceProviders)
router.get('/visit/by-type', recordOfficer.getVisitsByType);




// Get all visits for a patient
router.get('/visits/patient/:visit_id',adminAuthOrUserAuth,recordOfficer.getPatientVisits);

// records statistics
router.get('/statistics/',adminAuthOrUserAuth,recordsStats.getRecordStatistics);

// get all patients in the insitution
router.get('/patients/:institution_id',adminAuthOrUserAuth,recordOfficer.getAllPatients);
router.get('/patient/:id',adminAuthOrUserAuth,recordOfficer.getPatientDetails)
// get visit details
router.get('/visits/:visit_id',adminAuthOrUserAuth,recordOfficer.getVisitDetails);
router.patch('/patient/:patient_id',adminAuthOrUserAuth,recordOfficer.updatePatientInformation)
// update insurance provider
router.patch('/patient/insurance/:patient_id',adminAuthOrUserAuth,recordOfficer.updateInsuranceInformation);
// statistics visit
router.get('/visits/statistics/:visit_id',adminAuthOrUserAuth,recordOfficer.getVisitStatistics);




// // Get a single patient record by ID and institution ID
// router.get('/institution/patient/get-patient-details',adminAuthOrUserAuth, recordOfficer.getPatientRecord);

// // GET PATIENTS RECORDS IN AN INSTITUTION
// router.get('/institution',adminAuthOrUserAuth,recordOfficer.getAllPatientFromRecords)
// // router.get('/patient',adminAuthOrUserAuth,recordOfficer.getPatientRecord)

// // GET RECORDS STATISTICS
// router.get('/institution/records/statistics',recordsStats.getRecordStatistics)

// // GET PATIENTS BY STATUS
// router.get('/institution/patient/get-patient-by-status',adminAuthOrUserAuth,recordOfficer.getPatientByRecordStatus)
// // router.get('/institution/patient/get-patient-by-status',recordOfficer.getPatientByRecord

router.get('/patientReport',adminAuthOrUserAuth,patientReport.getPatientReport)


module.exports = router;
