const express = require('express');
const router = express.Router();
const theatreBookingController = require('../../controllers/theatre/theatreBookingController');

// CRUD Routes for Theatre Bookings
router.post('/theatre-bookings', theatreBookingController.createTheatreBooking);
router.get('/theatre-bookings', theatreBookingController.getAllTheatreBookings);
router.get('/theatre-bookings/upcoming', theatreBookingController.getUpcomingSurgeries);
router.get('/theatre-bookings/patient/:patientId', theatreBookingController.getSurgeriesByPatient);
router.get('/theatre-bookings/statistics', theatreBookingController.getSurgeryStatistics);
router.get('/theatre-bookings/:id', theatreBookingController.getTheatreBookingById);
router.put('/theatre-bookings/:id', theatreBookingController.updateTheatreBooking);
router.delete('/theatre-bookings/:id', theatreBookingController.cancelTheatreBooking);

// Surgery Status Routes
router.patch('/theatre-bookings/:id/start', theatreBookingController.startSurgery);
router.patch('/theatre-bookings/:id/complete', theatreBookingController.completeSurgery);
router.patch('/theatre-bookings/:id/discharge', theatreBookingController.dischargeFromRecovery);

// New: Get surgery status with duration
router.get('/theatre-bookings/:id/status', theatreBookingController.getSurgeryStatus);

// New: Update intra-operative notes in real-time
router.patch('/theatre-bookings/:id/intra-op-notes', theatreBookingController.updateIntraOpNotes);

module.exports = router;

