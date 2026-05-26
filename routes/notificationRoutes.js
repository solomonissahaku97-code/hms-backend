// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/eitherAuthOrAdminMiddleware');
const notificationController = require('../controllers/notificationController')


router.post('/notification/create',authenticateToken,notificationController.createNotification)

router.get('/get-notifications', authenticateToken, notificationController.getMyNotifications)

// Get unread notification count
router.get('/get-unread-count', authenticateToken, notificationController.getUnreadCount)

router.put('/notification/markAsRead',authenticateToken,notificationController.markAsRead)

// Mark all notifications as read
router.put('/notification/markAllAsRead', authenticateToken, notificationController.markAllAsRead)



module.exports = router;
