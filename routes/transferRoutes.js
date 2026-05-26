const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferRequest');
const authMiddleware = require('../middlewares/authMiddlewares');

// Route to initiate a transfer request
router.post('/transfer-patient/initiate',authMiddleware,  transferController.initiateTransfer);

// Route to approve a transfer request
router.post('/transfer-patient/approve', authMiddleware,transferController.approveTransfer);

// Route to reject a transfer request
router.post('/transfer-patient/reject/:transferId', authMiddleware, transferController.rejectTransfer);

// TRANSFER PATIENT FROM ONE DEPARTMENT TO ANOTHER
router.post('/transfer-patient/department/:department_id',authMiddleware,transferController.transferPatientDepartment)


module.exports = router; 
