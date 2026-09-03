const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const fcmService = require('../services/fcmService');
const smsService = require('../services/smsService');

/**
 * POST /register-device
 * Register an FCM device token for the authenticated user
 */
exports.registerDevice = async (req, res) => {
  try {
    const { fcm_token, platform } = req.body;
    const userId = req.user.id;

    if (!fcm_token) {
      return res.status(400).json({ error: 'fcm_token is required' });
    }

    // Get current device_tokens
    const [user] = await sequelize.query(
      'SELECT device_tokens FROM users WHERE id = :userId',
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    let tokens = [];
    if (user?.device_tokens) {
      tokens = typeof user.device_tokens === 'string' ? JSON.parse(user.device_tokens) : user.device_tokens;
    }

    // Add new token if not already present (max 5 devices)
    const tokenEntry = { token: fcm_token, platform: platform || 'unknown', addedAt: new Date().toISOString() };
    if (!tokens.find(t => t.token === fcm_token)) {
      tokens.push(tokenEntry);
      if (tokens.length > 5) tokens = tokens.slice(-5); // Keep most recent 5
    }

    await sequelize.query(
      'UPDATE users SET device_tokens = :tokens WHERE id = :userId',
      {
        replacements: { tokens: JSON.stringify(tokens), userId },
        type: QueryTypes.UPDATE,
      }
    );

    res.json({ success: true, message: 'Device registered', deviceCount: tokens.length });
  } catch (err) {
    console.error('[Notification] Register device error:', err);
    res.status(500).json({ error: 'Failed to register device' });
  }
};

/**
 * POST /unregister-device
 * Remove an FCM device token (on logout)
 */
exports.unregisterDevice = async (req, res) => {
  try {
    const { fcm_token } = req.body;
    const userId = req.user.id;

    if (!fcm_token) {
      return res.status(400).json({ error: 'fcm_token is required' });
    }

    const [user] = await sequelize.query(
      'SELECT device_tokens FROM users WHERE id = :userId',
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    let tokens = [];
    if (user?.device_tokens) {
      tokens = typeof user.device_tokens === 'string' ? JSON.parse(user.device_tokens) : user.device_tokens;
    }

    tokens = tokens.filter(t => t.token !== fcm_token);

    await sequelize.query(
      'UPDATE users SET device_tokens = :tokens WHERE id = :userId',
      {
        replacements: { tokens: JSON.stringify(tokens), userId },
        type: QueryTypes.UPDATE,
      }
    );

    res.json({ success: true, message: 'Device unregistered' });
  } catch (err) {
    console.error('[Notification] Unregister device error:', err);
    res.status(500).json({ error: 'Failed to unregister device' });
  }
};

/**
 * POST /send
 * Send a push notification to a specific user (service-to-service only)
 * Body: { user_id, title, body, type, data }
 */
exports.sendNotification = async (req, res) => {
  try {
    const { user_id, title, body: messageBody, type, data } = req.body;

    if (!user_id || !title || !messageBody) {
      return res.status(400).json({ error: 'user_id, title, and body are required' });
    }

    // Store notification in database
    try {
      await sequelize.query(
        `INSERT INTO patient_notifications (id, user_id, title, body, type, data, is_read, created_at)
         VALUES (gen_random_uuid(), :userId, :title, :body, :type, :data, false, NOW())`,
        {
          replacements: {
            userId: user_id,
            title,
            body: messageBody,
            type: type || 'general',
            data: JSON.stringify(data || {}),
          },
          type: QueryTypes.INSERT,
        }
      );
    } catch (storeErr) {
      console.error('[Notification] Failed to store notification:', storeErr.message);
    }

    const [user] = await sequelize.query(
      'SELECT device_tokens, phone, first_name, last_name FROM users WHERE id = :userId',
      { replacements: { userId: user_id }, type: QueryTypes.SELECT }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let pushResult = { sent: 0, failed: 0 };

    // Send FCM push
    let tokens = [];
    if (user.device_tokens) {
      tokens = typeof user.device_tokens === 'string' ? JSON.parse(user.device_tokens) : user.device_tokens;
    }

    if (tokens.length > 0) {
      const tokenStrings = tokens.map(t => t.token);
      const fcmPayload = {
        title,
        body: messageBody,
        data: { type: type || 'general', ...data },
      };

      const multicastResult = await fcmService.sendToMultiple(tokenStrings, fcmPayload);
      pushResult.sent = multicastResult.successCount || 0;
      pushResult.failed = multicastResult.failureCount || 0;

      // Clean up invalid tokens
      if (multicastResult.invalidTokens?.length > 0) {
        const validTokens = tokens.filter(t => !multicastResult.invalidTokens.includes(t.token));
        await sequelize.query(
          'UPDATE users SET device_tokens = :tokens WHERE id = :userId',
          {
            replacements: { tokens: JSON.stringify(validTokens), userId: user_id },
            type: QueryTypes.UPDATE,
          }
        );
      }
    }

    res.json({
      success: true,
      push: pushResult,
      message: `Notification sent to ${pushResult.sent} device(s)`,
    });
  } catch (err) {
    console.error('[Notification] Send error:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
};

/**
 * POST /send-sms
 * Send SMS to a user (service-to-service only)
 * Body: { user_id, message, patient_id? }
 */
exports.sendSMSNotification = async (req, res) => {
  try {
    const { user_id, phone: phoneOverride, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    let phone = phoneOverride;

    if (!phone && user_id) {
      const [user] = await sequelize.query(
        'SELECT phone FROM users WHERE id = :userId',
        { replacements: { userId: user_id }, type: QueryTypes.SELECT }
      );
      phone = user?.phone;
    }

    if (!phone) {
      return res.status(404).json({ error: 'No phone number found' });
    }

    const smsResult = await smsService.sendSMS(phone, message);
    res.json({ success: smsResult.success, message: smsResult.error || 'SMS sent' });
  } catch (err) {
    console.error('[Notification] SMS error:', err);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
};

/**
 * POST /notify-appointment
 * Convenience endpoint for appointment notifications
 * Body: { patient_user_id, doctor_name, date_time, patient_name, patient_phone }
 */
exports.notifyAppointment = async (req, res) => {
  try {
    const { patient_user_id, doctor_name, date_time, patient_name, patient_phone } = req.body;

    const [user] = await sequelize.query(
      'SELECT device_tokens, phone FROM users WHERE id = :userId',
      { replacements: { userId: patient_user_id }, type: QueryTypes.SELECT }
    );

    const results = { push: null, sms: null };

    // Push notification
    if (user?.device_tokens) {
      const tokens = typeof user.device_tokens === 'string' ? JSON.parse(user.device_tokens) : user.device_tokens;
      if (tokens.length > 0) {
        results.push = await fcmService.notifyAppointment(
          tokens[tokens.length - 1].token, patient_name, doctor_name, date_time
        );
      }
    }

    // SMS
    const phone = patient_phone || user?.phone;
    if (phone) {
      results.sms = await smsService.sendAppointmentReminder(phone, patient_name, doctor_name, date_time);
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('[Notification] Appointment notify error:', err);
    res.status(500).json({ error: 'Failed to send appointment notification' });
  }
};

/**
 * POST /notify-lab-result
 * Convenience endpoint for lab result notifications
 * Body: { patient_user_id, test_name, status, patient_name, patient_phone }
 */
exports.notifyLabResult = async (req, res) => {
  try {
    const { patient_user_id, test_name, status, patient_name, patient_phone } = req.body;

    const [user] = await sequelize.query(
      'SELECT device_tokens, phone FROM users WHERE id = :userId',
      { replacements: { userId: patient_user_id }, type: QueryTypes.SELECT }
    );

    const results = { push: null, sms: null };

    if (user?.device_tokens) {
      const tokens = typeof user.device_tokens === 'string' ? JSON.parse(user.device_tokens) : user.device_tokens;
      if (tokens.length > 0) {
        results.push = await fcmService.notifyLabResult(
          tokens[tokens.length - 1].token, patient_name, test_name, status
        );
      }
    }

    const phone = patient_phone || user?.phone;
    if (phone) {
      results.sms = await smsService.sendLabResultSMS(phone, patient_name, test_name);
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('[Notification] Lab result notify error:', err);
    res.status(500).json({ error: 'Failed to send lab result notification' });
  }
};

/**
 * GET /patient-notifications
 * Get notifications for the authenticated patient
 */
exports.getPatientNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, unread_only } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE user_id = :userId';
    const replacements = { userId, limit: parseInt(limit), offset };

    if (unread_only === 'true') {
      whereClause += ' AND is_read = false';
    }

    const notifications = await sequelize.query(
      `SELECT * FROM patient_notifications ${whereClause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) AS total FROM patient_notifications ${whereClause}`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    const [unreadResult] = await sequelize.query(
      'SELECT COUNT(*) AS count FROM patient_notifications WHERE user_id = :userId AND is_read = false',
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    res.json({
      data: notifications,
      unread_count: parseInt(unreadResult.count) || 0,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.total),
      },
    });
  } catch (err) {
    console.error('[Notification] Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * PATCH /patient-notifications/:id/read
 * Mark a notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await sequelize.query(
      'UPDATE patient_notifications SET is_read = true WHERE id = :id AND user_id = :userId',
      { replacements: { id, userId }, type: QueryTypes.UPDATE }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Notification] Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark notification' });
  }
};

/**
 * PATCH /patient-notifications/read-all
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await sequelize.query(
      'UPDATE patient_notifications SET is_read = true WHERE user_id = :userId AND is_read = false',
      { replacements: { userId }, type: QueryTypes.UPDATE }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Notification] Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark all notifications' });
  }
};

/**
 * DELETE /patient-notifications/:id
 * Delete a notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await sequelize.query(
      'DELETE FROM patient_notifications WHERE id = :id AND user_id = :userId',
      { replacements: { id, userId }, type: QueryTypes.DELETE }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Notification] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

/**
 * POST /notify-prescription
 * Convenience endpoint for prescription notifications
 * Body: { patient_user_id, medication_name, patient_name, patient_phone }
 */
exports.notifyPrescription = async (req, res) => {
  try {
    const { patient_user_id, medication_name, patient_name, patient_phone } = req.body;

    const [user] = await sequelize.query(
      'SELECT device_tokens, phone FROM users WHERE id = :userId',
      { replacements: { userId: patient_user_id }, type: QueryTypes.SELECT }
    );

    const results = { push: null, sms: null };

    if (user?.device_tokens) {
      const tokens = typeof user.device_tokens === 'string' ? JSON.parse(user.device_tokens) : user.device_tokens;
      if (tokens.length > 0) {
        results.push = await fcmService.notifyPrescription(
          tokens[tokens.length - 1].token, patient_name, medication_name
        );
      }
    }

    const phone = patient_phone || user?.phone;
    if (phone) {
      results.sms = await smsService.sendPrescriptionSMS(phone, patient_name, medication_name);
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('[Notification] Prescription notify error:', err);
    res.status(500).json({ error: 'Failed to send prescription notification' });
  }
};
