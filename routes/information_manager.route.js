// routes/information manager.js
const express = require('express');
const router = express.Router();

const patientAnalysisController = require('../controllers/information_manager/patientAnalysisController')
const fetchDiagnosisAnalysis = require('../controllers/information_manager/diagnosisAnalysisController')
const bedsStatisticsRoutes = require('../controllers/information_manager/bedStatisticsController')
const patientSummaryController = require("../controllers/information_manager/patientSummaryController");
const maternityAnalyticsController = require('../controllers/information_manager/maternityAnalyticsController');


// DIAGNOSIS ANALYSIS ROUTE
router.get('/diagnosis-analysis',fetchDiagnosisAnalysis.getDiagnosisAnalysis);

router.route('/info/maternity-data').get(maternityAnalyticsController.getMaternityAnalytics);


// PATIENT ANALYSIS ROUTE
router.get('/patient-analysis/total-visits',patientAnalysisController.getTotalVisits);
router.get('/patient-analysis/visits-by-type',patientAnalysisController.getVisitsByType);
router.get('/patient-analysis/admission-stats',patientAnalysisController.getAdmissionStats);
router.get('/patient-analysis/average-stay',patientAnalysisController.getAverageLengthOfStay);
router.get('/patient-analysis/discharge-stats',patientAnalysisController.getDischargeStats);
router.get('/patient-analysis/monthly-visits',patientAnalysisController.getMonthlyVisits);
router.get('/patient-analysis/visits-by-department',patientAnalysisController.getVisitsByDepartment);
router.get('/patient-stats', patientAnalysisController.getPatientVisitStats); // NEW

// beds statistics
router.get('/bed-statistics', bedsStatisticsRoutes.getBedStatistics);


// STATUS OF PATIENT SUMMARY
// ✅ Overall inpatient vs outpatient + gender summary
router.get("/patient-summary/inpatient-outpatient", patientSummaryController.getInpatientOutpatientSummary);
router.get("/patient-summary/monthly-trend", patientSummaryController.getMonthlyInpatientOutpatient);
router.get("/patient-summary/department-stats", patientSummaryController.getDepartmentInpatientOutpatient);







module.exports = router;