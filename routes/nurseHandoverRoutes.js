const express = require('express');
const router = express.Router();
const {
    createNurseHandover,
    getAllNurseHandovers,
    getNurseHandoverById,
    updateNurseHandover,
    deleteNurseHandover,
    getHandoversByVisit,
    getHandoversByNurse,
    acknowledgeHandover
} = require('../controllers/nuses_station/nurse_controller');

// CRUD Routes
router.post('/', createNurseHandover);
router.get('/', getAllNurseHandovers);
router.get('/:id', getNurseHandoverById);
router.put('/:id', updateNurseHandover);
router.delete('/:id', deleteNurseHandover);

// Special Routes
router.get('/visit/:visitId', getHandoversByVisit);
router.get('/nurse/:nurseId', getHandoversByNurse);
router.patch('/:id/acknowledge', acknowledgeHandover);

module.exports = router;