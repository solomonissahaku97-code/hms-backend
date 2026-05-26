const express = require('express');
const router = express.Router();
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware')


const consultationController = require('../controllers/consultation/consultationController')


// consultation
router.post('/request',eitherAuthOrAdmin, consultationController.requestConsultation);

// Route to approve a consultation
router.put('/approve/:id',eitherAuthOrAdmin, consultationController.approveConsultation);

// Route to get consultation results
router.get('/get-all-consultation',eitherAuthOrAdmin, consultationController.getConsultationResults);

router.delete('/reject/:id',eitherAuthOrAdmin,consultationController.rejectConsultation)

module.exports = router;
 