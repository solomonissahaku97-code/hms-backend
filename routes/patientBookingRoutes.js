const express = require('express');
const { getAllInstitutions,addPatientBooking } = require('../controllers/patientBookingsController');
const router = express.Router();

router.get('/institutions', getAllInstitutions);
router.post('/bookings/create-booking',addPatientBooking)

module.exports = router;
