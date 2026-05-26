const Notification = require('../models/notification');
const Staff = require('../models/staff');
const Department = require('../models/department');
const { Op } = require('sequelize');

// Notification types for categorization
const NOTIFICATION_TYPES = {
  PATIENT_NOTE_COMMENT: 'Patient_Note_Comment',
  MESSAGE: 'Message',
  SYSTEM: 'System',
  DEPARTMENT: 'Department',
  CALL: 'Call',
  ADMISSION: 'Admission',
  DISCHARGE: 'Discharge',
  LAB_RESULT: 'Lab_Result',
  PRESCRIPTION: 'Prescription',
  APPOINTMENT: 'Appointment',
  ASSIGNMENT: 'Assignment',
};

class NotificationService {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔔 Notification socket connected: ${socket.id}`);

      // Join staff-specific and department rooms
      socket.on('join-notification-room', async ({ staffId, departmentId }) => {
        if (staffId) {
          socket.join(`staff-${staffId}`);
          console.log(`Staff ${staffId} joined notification room`);
        }
        if (departmentId) {
          socket.join(`department-${departmentId}`);
          console.log(`Department ${departmentId} joined notification room`);
        }
      });

      // Leave notification room
      socket.on('leave-notification-room', ({ staffId, departmentId }) => {
        if (staffId) socket.leave(`staff-${staffId}`);
        if (departmentId) socket.leave(`department-${departmentId}`);
      });

      // Mark notifications as read
      socket.on('mark-notification-read', async ({ notificationIds, staffId }) => {
        await this.markAsRead(notificationIds, staffId);
      });

      // Mark all notifications as read
      socket.on('mark-all-notifications-read', async ({ staffId }) => {
        await this.markAllAsRead(staffId);
      });

      // Optional: allow system admin to broadcast notifications in real-time
      socket.on('broadcast-notification', async (data) => {
        await this.broadcastNotification(data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`🔔 Notification socket disconnected: ${socket.id}`);
      });
    });
  }

  // Save new notification and emit it
  async createNotification(data) {
    try {
      const notification = await Notification.create({
        title: data.title,
        description: data.description,
        from_department_id: data.from_department_id,
        to_department_id: data.to_department_id,
        from_staff_id: data.from_staff_id,
        to_staff_id: data.to_staff_id,
        institution_id: data.institution_id,
        priority: data.priority || 'Low',
        type: data.type || NOTIFICATION_TYPES.MESSAGE,
        broadcast: data.broadcast || false,
      });

      this.emitNotification(notification);
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Emit to appropriate receivers
  emitNotification(notification) {
    if (!this.io) {
      console.warn('Socket.io not initialized');
      return;
    }

    console.log(`📣 Emitting notification ${notification.id} to staff ${notification.to_staff_id}`);

    try {
      // To a specific staff
      if (notification.to_staff_id) {
        this.io.to(`staff-${notification.to_staff_id}`).emit('new-notification', notification);
      }

      // To a specific department
      if (notification.to_department_id) {
        this.io.to(`department-${notification.to_department_id}`).emit('new-department-notification', notification);
      }

      // Broadcast (system-wide)
      if (notification.broadcast) {
        this.io.emit('new-broadcast-notification', notification);
      }
    } catch (error) {
      console.error('Error emitting notification:', error);
    }
  }

  // Mark single or multiple notifications as read
  async markAsRead(notificationIds, staffId) {
    try {
      await Notification.update(
        { is_read: true },
        { where: { id: { [Op.in]: notificationIds }, to_staff_id: staffId } }
      );

      // Notify about read status
      notificationIds.forEach((id) => {
        this.io?.emit('notification-read', { id, staffId });
      });

      return { success: true };
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for a staff
  async markAllAsRead(staffId) {
    try {
      await Notification.update(
        { is_read: true },
        { where: { to_staff_id: staffId, is_read: false } }
      );

      this.io?.to(`staff-${staffId}`).emit('all-notifications-read', { staffId });

      return { success: true };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // System-wide broadcast
  async broadcastNotification(data) {
    const notification = await Notification.create({
      title: data.title,
      description: data.description,
      type: data.type || NOTIFICATION_TYPES.SYSTEM,
      broadcast: true,
      institution_id: data.institution_id,
      priority: data.priority || 'Medium',
    });

    this.io.emit('new-broadcast-notification', notification);
    return notification;
  }

  // Get notifications for a specific staff or department
  async getNotifications({ staffId, departmentId, limit = 50, includeRead = true }) {
    const where = {
      [Op.or]: [
        { to_staff_id: staffId },
        { broadcast: true }
      ]
    };

    if (!includeRead) {
      where.is_read = false;
    }

    return await Notification.findAll({
      where,
      limit,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Staff, as: 'fromStaff' },
        { model: Staff, as: 'toStaff' },
        { model: Department, as: 'fromDepartment' },
        { model: Department, as: 'toDepartment' },
      ],
    });
  }

  // Get unread notification count for a staff
  async getUnreadCount(staffId) {
    return await Notification.count({
      where: {
        to_staff_id: staffId,
        is_read: false
      }
    });
  }

  // Delete old notifications (cleanup)
  async deleteOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await Notification.destroy({
      where: {
        createdAt: { [Op.lt]: cutoffDate },
        is_read: true
      }
    });
  }
}

// Export both the class and the notification types
module.exports = NotificationService;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
