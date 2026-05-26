const express = require('express');
const router = express.Router();
const departmentCallController = require('../controllers/departmentCallController');

// Create a new call
router.post('/', departmentCallController.createCall);

// Update call status
router.put('/:id/status', departmentCallController.updateCallStatus);

// End a call
router.put('/:id/end', departmentCallController.endCall);

// Get user call history
router.get('/user/:userId', departmentCallController.getUserCallHistory);

// Get missed calls
router.get('/missed/:userId', departmentCallController.getMissedCalls);

// Get active calls
router.get('/active/:userId', departmentCallController.getActiveCalls);

// Get department statistics
router.get('/stats/:departmentId', departmentCallController.getDepartmentStats);

module.exports = router;
