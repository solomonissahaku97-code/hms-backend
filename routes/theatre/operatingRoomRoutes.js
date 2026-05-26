// routes/theatre/operatingRoomRoutes.js
const express = require('express');
const router = express.Router();
const operatingRoomController = require('../../controllers/theatre/operatingRoomController');

// CRUD Routes
router.post('/operating-rooms', operatingRoomController.createOperatingRoom);
router.get('/operating-rooms', operatingRoomController.getAllOperatingRooms);
router.get('/operating-rooms/availability', operatingRoomController.getRoomAvailability);
router.get('/operating-rooms/statistics', operatingRoomController.getORStatistics);
router.get('/operating-rooms/:id', operatingRoomController.getOperatingRoomById);
router.put('/operating-rooms/:id', operatingRoomController.updateOperatingRoom);
router.delete('/operating-rooms/:id', operatingRoomController.deleteOperatingRoom);
router.patch('/operating-rooms/:id/status', operatingRoomController.updateRoomStatus);

module.exports = router;

