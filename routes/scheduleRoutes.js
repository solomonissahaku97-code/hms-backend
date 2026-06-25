const express = require('express');

const shdeduleAppointmentController = require('../controllers/shdeduleAppointmentController');

const router = express.Router();

// Schedules (Appointment) APIs
router.post('/appointments/create', shdeduleAppointmentController.createAppointment);
router.get('/appointments/institution', shdeduleAppointmentController.getAllAppointments);
router.get('/appointments/patient', shdeduleAppointmentController.fetchPatientAppointments);
router.get('/appointment/doctor', shdeduleAppointmentController.getAppointmentByDoctorId);
router.post('/appointment/approve', shdeduleAppointmentController.approveAppointment);
router.get('/appointments/upcoming', shdeduleAppointmentController.getUpcomingAppointments);

module.exports = router;

