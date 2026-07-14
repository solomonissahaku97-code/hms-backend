// controllers/notificationController.js
const { Op } = require('sequelize');

const notificationService = require('../service/notificationService'); // Singleton
const { NOTIFICATION_TYPES } = require('../service/notificationService');

// Helper to normalize socket ids / rooms
const normalizeRoomIds = ({ staffId, departmentId }) => ({
  staffRoom: staffId ? `staff-${staffId}` : null,
  departmentRoom: departmentId ? `department-${departmentId}` : null,
});



// controllers/notificationController.js

exports.createNotification = async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');

    const body = { ...req.body };

    const notification = await notificationService.createNotification(body);
    return res.status(201).json(notification);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


exports.getMyNotifications = async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');

    const { staffId } = req.query;
    // allow: includeRead=true|false (default true)
    const includeReadRaw = req.query.includeRead;
    const includeRead =
      includeReadRaw === undefined ? true : String(includeReadRaw) === 'true';

    if (!staffId) {
      return res.status(400).json({ error: 'staffId is required' });
    }

    const notifications = await notificationService.getNotifications({
      staffId,
      includeRead,
    });
    console.log(notifications);

    return res.json({ success: true, data: notifications });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


exports.getMyUnreadNotifications = async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');

    const { staffId } = req.query;

    if (!staffId) {
      return res.status(400).json({ error: 'staffId is required' });
    }

    const notifications = await notificationService.getNotifications({
      staffId,
      includeRead: false,
    });

    return res.json({ success: true, data: notifications });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
