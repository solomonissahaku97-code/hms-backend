const express = require('express');
const router = express.Router();
const { getStatisticsAndSummary, getPatientBills } = require('../controllers/statisticsController');
const { getRecentActivities } = require('../controllers/activityController');
const { getUpcomingAppointments } = require('../controllers/shdeduleAppointmentController');

// Route for fetching statistics and summary
router.get('/statistics', getStatisticsAndSummary);
router.get('/statistics/summary', getStatisticsAndSummary);

// Revenue trends - using existing statistics data
router.get('/statistics/revenue-trends', getStatisticsAndSummary);

// Department performance - using existing statistics data  
router.get('/statistics/department-performance', getStatisticsAndSummary);

// Recent activities
router.get('/activity/recent', getRecentActivities);

// Patient bills
router.get('/patients/bills', getPatientBills);


module.exports = router;
