const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const config = require('../config/conf');

let initialized = false;

function initFirebase() {
  if (initialized) return true;

  // 1. Try loading from service account JSON file (preferred)
  const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      initialized = true;
      console.log('✅ Firebase Admin initialized from service account file');
      console.log(`   Project: ${serviceAccount.project_id}`);
      return true;
    } catch (err) {
      console.error('[FCM] Failed to initialize from service account file:', err.message);
    }
  }

  // 2. Fall back to individual env vars
  if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      });
      initialized = true;
      console.log('✅ Firebase Admin initialized from env vars');
      return true;
    } catch (err) {
      console.error('[FCM] Failed to initialize from env vars:', err.message);
    }
  }

  console.warn('[FCM] Firebase credentials not configured — push notifications disabled');
  return false;
}

async function sendToDevice(token, payload) {
  if (!initialized) return null;
  try {
    const result = await admin.messaging().send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      android: { priority: 'high', notification: { channelId: payload.channelId || 'hms-default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    return result;
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered') {
      return { invalidToken: true };
    }
    console.error('[FCM] Send failed:', err.message);
    return null;
  }
}

async function sendToMultiple(tokens, payload) {
  if (!initialized || !tokens.length) return [];
  const message = {
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data || {},
    android: { priority: 'high', notification: { channelId: payload.channelId || 'hms-default' } },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  };
  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    const invalidTokens = [];
    response.responses.forEach((res, idx) => {
      if (!res.success && res.error?.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(tokens[idx]);
      }
    });
    return { successCount: response.successCount, failureCount: response.failureCount, invalidTokens };
  } catch (err) {
    console.error('[FCM] Multicast failed:', err.message);
    return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
  }
}

async function notifyAppointment(token, patientName, doctorName, dateTime) {
  return sendToDevice(token, {
    title: '📅 Appointment Reminder',
    body: `You have an appointment with Dr. ${doctorName} on ${new Date(dateTime).toLocaleString()}`,
    data: { type: 'appointment', patientName, doctorName, dateTime },
    channelId: 'hms-appointments',
  });
}

async function notifyLabResult(token, patientName, testName, status) {
  return sendToDevice(token, {
    title: '🔬 Lab Result Ready',
    body: `Your ${testName} result is now ${status}`,
    data: { type: 'lab_result', patientName, testName, status },
    channelId: 'hms-lab-results',
  });
}

async function notifyPrescription(token, patientName, medicationName) {
  return sendToDevice(token, {
    title: '💊 Prescription Update',
    body: `Your prescription for ${medicationName} has been updated`,
    data: { type: 'prescription', patientName, medicationName },
    channelId: 'hms-prescriptions',
  });
}

module.exports = {
  initFirebase,
  isInitialized: () => initialized,
  sendToDevice,
  sendToMultiple,
  notifyAppointment,
  notifyLabResult,
  notifyPrescription,
  admin,
};
