const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meeting/meetingController');

// Create a new meeting
router.post('/', meetingController.createMeeting);

// Get all meetings
router.get('/', meetingController.getMeetings);

// Get a single meeting by ID

// Cancel a meeting
router.put('/:id/cancel', meetingController.cancelMeeting);

// Join a meeting (returns Jitsi URL)
router.get('/:id/join', meetingController.joinMeeting);

module.exports = router;
