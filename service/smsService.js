const axios = require('axios');

const sendSMS = async (phoneNumber, message) => {
    try {
        if (!process.env.SMS_API_KEY) {
            console.warn('[SMS] SMS_API_KEY environment variable is not set — SMS delivery disabled');
            return { success: false, error: 'SMS_API_KEY is not configured' };
        }
        console.log(`[SMS] Sending to ${phoneNumber} (length: ${phoneNumber.length})`);

        const smsApiUrl = 'https://sms.arkesel.com/sms/api';
        
        const response = await axios.get(smsApiUrl, {
            params: {
                action: 'send-sms',
                api_key: process.env.SMS_API_KEY,
                to: phoneNumber,
                from: 'Tonitel',
                sms: message
            }
        });

        if (response.data && response.data.code === 'ok') {
            console.log(`[SMS] Successfully sent to ${phoneNumber}`);
            return { success: true, data: response.data };
        } else {
            console.error(`[SMS] API returned non-ok for ${phoneNumber}:`, response.data);
            return { success: false, error: response.data };
        }
    } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;
        console.error(`[SMS] Failed to send to ${phoneNumber}:`, status, data || error.message);
        return { success: false, error: data || error.message };
    }
};

const scheduleSMS = async (phoneNumber, message, scheduleTime) => {
    try {
        if (!process.env.SMS_API_KEY) {
            return { success: false, error: 'SMS_API_KEY is not configured' };
        }

        const smsApiUrl = 'https://sms.arkesel.com/sms/api';
        
        const response = await axios.get(smsApiUrl, {
            params: {
                action: 'send-sms',
                api_key: process.env.SMS_API_KEY,
                to: phoneNumber,
                from: 'Falcon-hive',
                sms: message,
                schedule: scheduleTime
            }
        });

        if (response.data && (response.data.code === 'ok' || response.data.status === 'success')) {
            return { success: true, data: response.data };
        } else {
            return { success: false, error: response.data };
        }
    } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;
        console.error('Error scheduling SMS:', status, data || error.message);
        return { success: false, error: data || error.message };
    }
};

module.exports = { sendSMS, scheduleSMS };
