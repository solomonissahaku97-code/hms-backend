// controllers/notificationController.js
const notificationService = require('../service/notificationService'); // Singleton
const { NOTIFICATION_TYPES } = require('../service/notificationService');

// controllers/notificationController.js

exports.createNotification = async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const notification = await notificationService.createNotification(req.body);
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const { staffId, includeRead = 'true' } = req.query;
    const notifications = await notificationService.getNotifications({ 
      staffId, 
      includeRead: includeRead === 'true' 
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const { staffId } = req.query;
    const count = await notificationService.getUnreadCount(staffId);
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const { notificationIds, staffId } = req.body;
    await notificationService.markAsRead(notificationIds, staffId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const { staffId } = req.body;
    await notificationService.markAllAsRead(staffId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Export notification types for use in other controllers
exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
