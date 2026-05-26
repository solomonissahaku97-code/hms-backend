const express = require('express');
const router = express.Router();
const controller = require('../controllers/theatre/theatrePatientController');

router.post('/theatre-bookings', controller.createTheatrePatient);
router.get('/theatre-bookings', controller.getAllTheatrePatients);
router.get('/:id', controller.getTheatrePatientById);
router.put('/:id', controller.updateTheatrePatient);
router.delete('/:id', controller.deleteTheatrePatient);

module.exports = router;
