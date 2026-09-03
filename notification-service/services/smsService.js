const https = require('https');
const config = require('../config/conf');

/**
 * Send SMS via Arkesel API
 * @param {string} to - Phone number (e.g. "+233XXXXXXXXX")
 * @param {string} message - SMS body
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendSMS(to, message) {
  if (!config.sms.apiKey) {
    console.warn('[SMS] SMS_API_KEY not configured — SMS disabled');
    return { success: false, error: 'SMS not configured' };
  }

  const params = new URLSearchParams({
    to: to.replace(/[^0-9+]/g, ''),
    message,
    sender: config.sms.senderId,
  });

  return new Promise((resolve) => {
    const url = `https://sms.arkesel.com/api/v2/sms/send?${params.toString()}`;

    https.get(url, {
      headers: { 'api-key': config.sms.apiKey },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.status === 'success') {
            resolve({ success: true, messageId: data.message_id });
          } else {
            resolve({ success: false, error: data.message || 'SMS send failed' });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse SMS response' });
        }
      });
    }).on('error', (err) => {
      resolve({ success: false, error: err.message });
    }).on('timeout', function () {
      this.destroy();
      resolve({ success: false, error: 'SMS request timed out' });
    });
  });
}

/**
 * Send appointment reminder SMS
 */
async function sendAppointmentReminder(phone, patientName, doctorName, dateTime) {
  const message = `Hi ${patientName}, you have an appointment with Dr. ${doctorName} on ${new Date(dateTime).toLocaleString()}. - Tonitel HMS`;
  return sendSMS(phone, message);
}

/**
 * Send lab result ready SMS
 */
async function sendLabResultSMS(phone, patientName, testName) {
  const message = `Hi ${patientName}, your ${testName} result is ready. Please check your patient portal. - Tonitel HMS`;
  return sendSMS(phone, message);
}

/**
 * Send prescription ready SMS
 */
async function sendPrescriptionSMS(phone, patientName, medicationName) {
  const message = `Hi ${patientName}, your prescription for ${medicationName} is ready for pickup. - Tonitel HMS`;
  return sendSMS(phone, message);
}

module.exports = {
  sendSMS,
  sendAppointmentReminder,
  sendLabResultSMS,
  sendPrescriptionSMS,
};
