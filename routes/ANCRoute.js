const express = require('express');
const router = express.Router();
// const obstetricController = require('../controllers/ANCController/obstetricController');

const { createANC,deleteANC,updateANC,getPregnancyTimeline,getANCsByVisit } = require('../controllers/maternity/ancController')


// ANC ROUTES
router.post('/create/', createANC);
router.delete('/delete/:id/:patient_id', deleteANC);
router.patch('/update/:id/', updateANC);
router.get('/timeline/:visit_id', getPregnancyTimeline);
router.get("/visit/:visit_id", getANCsByVisit);

module.exports = router;