/**
 * FCM Notification Helper
 *
 * Sends push notifications through the notification-service microservice
 * which uses Firebase Admin SDK to deliver to registered devices.
 *
 * Replaces the Pusher Beams-based helpers for a unified Firebase approach.
 */

const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3013";
const SERVICE_KEY = process.env.HMS_SERVICE_KEY || "dev-service-key";

/**
 * Generic helper — send a push notification to a single user via the
 * notification-service.
 *
 * @param {Object} opts
 * @param {string}  opts.user_id       - Target user / staff id
 * @param {string}  opts.title         - Notification title
 * @param {string}  opts.body          - Notification body text
 * @param {string}  [opts.type]        - Event type (e.g. "diagnosis", "lab_result")
 * @param {Object}  [opts.data]        - Extra data payload
 */
async function sendPushNotification({ user_id, title, body, type, data }) {
  if (!user_id || !title || !body) {
    console.warn("[FCM Helper] Skipping — missing required fields", { user_id, title });
    return null;
  }

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notification/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ user_id, title, body, type, data }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[FCM Helper] Notification service error:", response.status, text);
      return null;
    }

    const result = await response.json();
    console.log("[FCM Helper] Notification sent:", result.message);
    return result;
  } catch (err) {
    console.error("[FCM Helper] Failed to send notification:", err.message);
    return null;
  }
}

/**
 * Send a push notification to all staff in a department.
 *
 * @param {Object} opts
 * @param {string}  opts.department_id
 * @param {string}  opts.institution_id
 * @param {string}  opts.title
 * @param {string}  opts.body
 * @param {string}  [opts.type]
 * @param {Object}  [opts.data]
 */
async function sendNotificationToDepartment({ department_id, institution_id, title, body, type, data }) {
  try {
    // Import models lazily to avoid circular deps
    const Staff = require("../models/staff");
    const users = await Staff.findAll({
      where: { department_id, institution_id },
      attributes: ["id"],
    });

    if (users.length === 0) {
      console.log("[FCM Helper] No staff in department", department_id);
      return;
    }

    // Send to each staff member (notification-service handles token lookup)
    const results = await Promise.allSettled(
      users.map((user) =>
        sendPushNotification({ user_id: user.id, title, body, type, data })
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
    console.log(`[FCM Helper] Sent to ${sent}/${users.length} staff in department ${department_id}`);
  } catch (err) {
    console.error("[FCM Helper] Department notification error:", err.message);
  }
}

/**
 * Send a push notification to a specific user.
 */
async function sendNotificationToUser({ userId, title, body, type, data }) {
  return sendPushNotification({ user_id: userId, title, body, type, data });
}

/**
 * Send a push notification to an admin.
 */
async function sendNotificationToAdmin({ adminId, title, body, type, data }) {
  return sendPushNotification({ user_id: adminId, title, body, type, data });
}

/**
 * Convenience: notify that a diagnosis was added for a patient.
 */
async function notifyDiagnosisAdded({ staff_id, department_id, institution_id, patient_name, visit_id }) {
  const title = "📋 New Diagnosis Added";
  const body = `A diagnosis has been recorded for ${patient_name || "a patient"}.`;

  // Notify the department so other staff are aware
  if (department_id && institution_id) {
    await sendNotificationToDepartment({
      department_id,
      institution_id,
      title,
      body,
      type: "diagnosis",
      data: { visit_id, patient_name },
    });
  }

  // Also notify the staff member who created it (confirmation)
  if (staff_id) {
    await sendNotificationToUser({
      userId: staff_id,
      title,
      body: `Your diagnosis for ${patient_name || "the patient"} has been saved.`,
      type: "diagnosis",
      data: { visit_id, patient_name },
    });
  }
}

/**
 * Convenience: notify that a lab result is ready.
 */
async function notifyLabResultReady({ patient_user_id, patient_name, test_name, status }) {
  return sendPushNotification({
    user_id: patient_user_id,
    title: "🔬 Lab Result Ready",
    body: `Your ${test_name} result is now ${status}.`,
    type: "lab_result",
    data: { patient_name, test_name, status },
  });
}

module.exports = {
  sendPushNotification,
  sendNotificationToDepartment,
  sendNotificationToUser,
  sendNotificationToAdmin,
  notifyDiagnosisAdded,
  notifyLabResultReady,
};
