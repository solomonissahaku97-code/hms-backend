const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const notification = require('../controllers/notificationController');

// ── Device Token Management (patient-authenticated) ──
router.post('/register-device', authenticate, notification.registerDevice);
router.post('/unregister-device', authenticate, notification.unregisterDevice);

// ── Patient Notifications (patient-authenticated) ──
router.get('/patient-notifications', authenticate, notification.getPatientNotifications);
router.patch('/patient-notifications/:id/read', authenticate, notification.markAsRead);
router.patch('/patient-notifications/read-all', authenticate, notification.markAllAsRead);
router.delete('/patient-notifications/:id', authenticate, notification.deleteNotification);

// ── Generic Notification Sending (service-to-service) ──
router.post('/send', authenticate, notification.sendNotification);
router.post('/send-sms', authenticate, notification.sendSMSNotification);

// ── Typed Notification Convenience Endpoints ──
router.post('/notify-appointment', authenticate, notification.notifyAppointment);
router.post('/notify-lab-result', authenticate, notification.notifyLabResult);
router.post('/notify-prescription', authenticate, notification.notifyPrescription);

module.exports = router;
