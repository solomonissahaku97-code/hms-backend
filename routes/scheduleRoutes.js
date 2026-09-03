const express = require('express');

const shdeduleAppointmentController = require('../controllers/shdeduleAppointmentController');

const router = express.Router();

// Schedules (Appointment) APIs
router.post('/appointments/create', shdeduleAppointmentController.createAppointment);
router.get('/appointments/institution', shdeduleAppointmentController.getAllAppointments);
router.get('/appointments/patient', shdeduleAppointmentController.fetchPatientAppointments);

// Doctor appointment listing
router.get('/appointment/doctor', shdeduleAppointmentController.getAppointmentByDoctorId);
router.get(
  '/appointments/doctor/upcoming',
  shdeduleAppointmentController.getUpcomingAppointmentsByDoctorId
);

// Approve/modify
router.post('/appointment/approve', shdeduleAppointmentController.approveAppointment);
router.delete('/appointments/delete', shdeduleAppointmentController.deleteAppointment);

// Doctor confirm/reject appointment
router.patch('/appointments/confirm', shdeduleAppointmentController.confirmAppointment);
router.patch('/appointments/reject', shdeduleAppointmentController.rejectAppointment);

// Institution-wide upcoming appointment listing
router.get('/appointments/upcoming', shdeduleAppointmentController.getUpcomingAppointments);


module.exports = router;

