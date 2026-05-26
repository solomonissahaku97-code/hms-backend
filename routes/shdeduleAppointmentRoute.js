const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddlewares');
const verifyAdminToken = require('../middlewares/adminMiddleware')
const shdeduleAppointmentController = require('../controllers/shdeduleAppointmentController')
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware');





// Route to create an appointment
router.post('/appointments/create', shdeduleAppointmentController.createAppointment);
router.get('/appointments/institution',shdeduleAppointmentController.getAllAppointments);
router.get('/appointments/patient',shdeduleAppointmentController.fetchPatientAppointments)
router.get('/appointment/doctor',shdeduleAppointmentController.getAppointmentByDoctorId)
router.post('/appointment/approve',shdeduleAppointmentController.approveAppointment)
router.get('/appointments/upcoming', shdeduleAppointmentController.getUpcomingAppointments)

module.exports = router;
 