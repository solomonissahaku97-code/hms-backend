/**
 * Lightweight notification helper for consultation-service.
 * Calls the notification-service via HTTP using Docker network.
 */

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3013';
const SERVICE_KEY = process.env.SERVICE_AUTH_SECRET || process.env.HMS_SERVICE_KEY || 'change-me-in-production';

async function sendPush(userId, title, body, type = 'general', data = {}) {
  if (!userId || !title) return null;
  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notification/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': SERVICE_KEY,
      },
      body: JSON.stringify({ user_id: userId, title, body, type, data }),
    });
    if (!response.ok) {
      console.log(`[Notify] Push failed (${response.status}) for user ${userId}`);
      return null;
    }
    console.log(`[Notify] Push sent to ${userId}: ${title}`);
    return await response.json();
  } catch (err) {
    console.error(`[Notify] Push error for ${userId}:`, err.message);
    return null;
  }
}

async function notifyAppointment({ patient_user_id, patient_name, patient_phone, doctor_name, date_time }) {
  if (!patient_user_id || !doctor_name || !date_time) return null;
  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notification/notify-appointment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': SERVICE_KEY,
      },
      body: JSON.stringify({
        patient_user_id,
        patient_name: patient_name || 'Patient',
        patient_phone: patient_phone || null,
        doctor_name,
        date_time,
      }),
    });
    if (!response.ok) {
      console.log(`[Notify] Appointment notification failed (${response.status})`);
      return null;
    }
    const result = await response.json();
    console.log(`[Notify] Appointment notification sent:`, result);
    return result;
  } catch (err) {
    console.error('[Notify] Appointment notification error:', err.message);
    return null;
  }
}

module.exports = { sendPush, notifyAppointment };
