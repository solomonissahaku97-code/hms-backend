const express = require('express');
const router = express.Router();
const { createPatientNote, getPatientNotes, updatePatientNote, deletePatientNote,addCommentToNote } = require('../controllers/patient_note/patientNoteController');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')


// Create a patient note
router.post('/notes/create',eitherAuthOrAdmin, createPatientNote);

// Get patient notes
router.get('/notes',eitherAuthOrAdmin, getPatientNotes);

// add comment to patent note
router.post('/notes/comment', addCommentToNote);






module.exports = router;
