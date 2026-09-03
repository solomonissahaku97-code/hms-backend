/**
 * Push Notification Helper — Patient-Facing
 *
 * Sends FCM push notifications to patients via the notification-service.
 * Used by appointment, lab, and prescription controllers.
 */

const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3013";
const SERVICE_KEY = process.env.HMS_SERVICE_KEY || "dev-service-key";

/**
 * Find the patient's user record (users table with user_type='PATIENT')
 * by looking up the patient's folder_number.
 */
async function findPatientUserId(patientId) {
  try {
    const Patient = require("../models/patient");
    const { sequelize } = require("../models");
    const { QueryTypes } = require("sequelize");

    const patient = await Patient.findByPk(patientId, {
      attributes: ["id", "folder_number"],
    });
    if (!patient?.folder_number) return null;

    const [user] = await sequelize.query(
      `SELECT id FROM users WHERE staff_id_code = :folder AND user_type = 'PATIENT'`,
      { replacements: { folder: patient.folder_number }, type: QueryTypes.SELECT }
    );
    return user?.id || null;
  } catch (err) {
    console.error("[PushHelper] findPatientUserId error:", err.message);
    return null;
  }
}

/**
 * Send a push notification to a single user via the notification-service.
 */
async function sendPushToUser(userId, title, body, type, data) {
  if (!userId || !title || !body) return null;
  try {
    const response = await fetch(
      `${NOTIFICATION_SERVICE_URL}/api/v1/notification/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ user_id: userId, title, body, type, data }),
      }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("[PushHelper] sendPushToUser error:", err.message);
    return null;
  }
}

/**
 * Notify a patient about an appointment event.
 *
 * @param {string} patientId - The Patient model ID
 * @param {Object} details
 * @param {string} details.doctorName
 * @param {string} details.date - Formatted date string
 * @param {string} details.type - 'created' | 'updated' | 'cancelled'
 */
async function notifyPatientAppointment(patientId, { doctorName, date, type }) {
  const userId = await findPatientUserId(patientId);
  if (!userId) {
    console.log("[PushHelper] No patient user found for appointment notification");
    return;
  }

  let title, body;
  switch (type) {
    case "cancelled":
      title = "📅 Appointment Cancelled";
      body = `Your appointment with Dr. ${doctorName} on ${date} has been cancelled.`;
      break;
    case "updated":
      title = "📅 Appointment Updated";
      body = `Your appointment with Dr. ${doctorName} has been updated. Date: ${date}.`;
      break;
    case "created":
    default:
      title = "📅 Appointment Scheduled";
      body = `Your appointment with Dr. ${doctorName} is scheduled for ${date}.`;
      break;
  }

  return sendPushToUser(userId, title, body, "appointment", {
    doctorName,
    date,
    type,
  });
}

/**
 * Notify a patient that their lab result is ready.
 */
async function notifyPatientLabResult(patientId, testName) {
  const userId = await findPatientUserId(patientId);
  if (!userId) return;

  return sendPushToUser(
    userId,
    "🔬 Lab Result Ready",
    `Your ${testName || "lab test"} result is now available.`,
    "lab_result",
    { testName }
  );
}

/**
 * Notify a patient about a prescription update.
 */
async function notifyPatientPrescription(patientId, medicationName, status) {
  const userId = await findPatientUserId(patientId);
  if (!userId) return;

  let title = "💊 Prescription Update";
  let body = `Your prescription for ${medicationName || "medication"} has been updated.`;

  if (status === "approved") {
    title = "💊 Prescription Approved";
    body = `Your prescription for ${medicationName || "medication"} has been approved and is ready for pickup.`;
  } else if (status === "issued") {
    title = "💊 Prescription Ready";
    body = `Your prescription for ${medicationName || "medication"} is ready for collection.`;
  }

  return sendPushToUser(userId, title, body, "prescription", {
    medicationName,
    status,
  });
}

module.exports = {
  findPatientUserId,
  sendPushToUser,
  notifyPatientAppointment,
  notifyPatientLabResult,
  notifyPatientPrescription,
};
