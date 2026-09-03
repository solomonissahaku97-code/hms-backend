const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized) return true;
  console.warn('[FCM] Firebase credentials not configured — push notifications disabled');
  return false;
}

async function sendToDevice(token, payload) {
  if (!initialized) return null;
  return null;
}

async function sendToMultiple(tokens, payload) {
  if (!initialized || !tokens.length) return [];
  return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
}

async function notifyAppointment(token, patientName, doctorName, dateTime) {
  return null;
}

async function notifyLabResult(token, patientName, testName, status) {
  return null;
}

async function notifyPrescription(token, patientName, medicationName) {
  return null;
}

module.exports = {
  initFirebase,
  sendToDevice,
  sendToMultiple,
  notifyAppointment,
  notifyLabResult,
  notifyPrescription,
  admin,
};
