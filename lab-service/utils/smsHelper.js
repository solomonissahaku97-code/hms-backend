/**
 * SMS Helper — lightweight SMS sender.
 * In production, this should call the Notifications Service.
 */

const http = require('http');

async function sendSMS(phone, message) {
  const notificationsUrl = process.env.NOTIFICATIONS_SERVICE_URL;
  const serviceSecret = process.env.NOTIFICATIONS_SERVICE_SECRET;

  if (!notificationsUrl) {
    console.log(`[SMS Stub] Would send SMS to ${phone}: ${message.substring(0, 50)}...`);
    return { success: true, provider: 'stub' };
  }

  // Call the notifications service
  const url = new URL(`${notificationsUrl}/api/v1/notifications/send/`);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const crypto = require('crypto');
  const signature = crypto.createHmac('sha256', serviceSecret).update(`hms-lab-service:${timestamp}`).digest('hex');

  const postData = JSON.stringify({
    recipient: phone,
    channel: 'sms',
    body: message,
    data: {},
  });

  return new Promise((resolve) => {
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Auth': signature,
        'X-Service-Name': 'hms-lab-service',
        'X-Timestamp': timestamp,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, provider: 'notifications-service' });
        } else {
          console.error(`[SMS] Notifications service returned ${res.statusCode}`);
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[SMS] Failed to call notifications service:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = { sendSMS };
