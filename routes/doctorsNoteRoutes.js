const express = require('express');
const router = express.Router();
const { createDoctorsNote,getNotesByVisit,getSingleNote,updateDoctorsNote,signDoctorsNote,deleteDoctorsNote } = require('../controllers/doctorsNoteController')
const auth = require('../middlewares/eitherAuthOrAdminMiddleware')


router.post('/doctors-notes', auth, createDoctorsNote);
router.get('/doctors-notes/visit/:visitId', auth, getNotesByVisit);
router.get('/doctors-notes/:id', auth, getSingleNote);
router.put('/doctors-notes/:id', auth, updateDoctorsNote);
router.post('/doctors-notes/:id/sign', auth, signDoctorsNote);
router.delete('/doctors-notes/:id', auth, deleteDoctorsNote);


module.exports = router;
