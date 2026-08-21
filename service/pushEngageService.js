const axios = require('axios');

const PUSH_ENGAGE_APP_ID = process.env.PUSH_ENGAGE_APP_ID || 'e68bb118-cfc8-4411-a144-f069028b7a65';
const PUSH_ENGAGE_API_KEY = process.env.PUSH_ENGAGE_API_KEY;
const PUSH_ENGAGE_API_SECRET = process.env.PUSH_ENGAGE_API_SECRET;
const PUSH_ENGAGE_API_URL = process.env.PUSH_ENGAGE_API_URL || 'https://api.pushengage.com/rest/v1/notification/create-campaign';

async function sendPushEngageNotification({ title, message, url, targetType = 'all', tag }) {
  if (!PUSH_ENGAGE_API_KEY || !PUSH_ENGAGE_API_SECRET) {
    console.warn('PushEngage: API credentials not configured. Set PUSH_ENGAGE_API_KEY and PUSH_ENGAGE_API_SECRET env vars. Skipping.');
    return;
  }

  if (!PUSH_ENGAGE_APP_ID) {
    console.warn('PushEngage: PUSH_ENGAGE_APP_ID not set. Using fallback may cause 404 in production.');
  }

  try {
    const payload = {
      id: `hms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      app_id: PUSH_ENGAGE_APP_ID,
      title,
      message,
      url: url || process.env.FRONTEND_URL || '',
      target_type: targetType,
      ...(tag && { tag })
    };

    const response = await axios.post(PUSH_ENGAGE_API_URL, payload, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${PUSH_ENGAGE_API_KEY}:${PUSH_ENGAGE_API_SECRET}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log(`PushEngage notification sent: ${response.data?.id || payload.id}`);
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    const isHtml = typeof data === 'string' && data.trim().startsWith('<!DOCTYPE');
    const errMsg = isHtml
      ? `PushEngage returned ${status || 'error'} (HTML response). URL: ${PUSH_ENGAGE_API_URL}. APP_ID: ${PUSH_ENGAGE_APP_ID}. Verify PUSH_ENGAGE_API_KEY, PUSH_ENGAGE_API_SECRET, PUSH_ENGAGE_APP_ID env vars match your PushEngage dashboard.`
      : (data?.message || data?.error || error.message);
    console.error('Failed to send PushEngage notification:', errMsg);
  }
}

module.exports = {
  sendPushEngageNotification,
  sendPushEngageDepartmentNotification: async ({ departmentId, title, message, url }) => {
    return sendPushEngageNotification({
      title,
      message,
      url,
      targetType: 'tag',
      tag: `department-${departmentId}`
    });
  }
};
