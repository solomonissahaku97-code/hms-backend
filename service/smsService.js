const axios = require('axios');

const sendSMS = async (phoneNumber, message) => {
    try {
        if (!process.env.SMS_API_KEY) {
            return { success: false, error: 'SMS_API_KEY is not configured' };
        }

        const smsApiUrl = 'https://sms.arkesel.com/sms/api';
        
        const params = new URLSearchParams();
        params.append('action', 'send-sms');
        params.append('api_key', process.env.SMS_API_KEY);
        params.append('to', phoneNumber);
        params.append('from', 'Tonitel');
        params.append('sms', message);

        const response = await axios.post(smsApiUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.data && response.data.code === 'ok') {
            return { success: true, data: response.data };
        } else {
            return { success: false, error: response.data };
        }
    } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;
        console.error('Error sending SMS:', status, data || error.message);
        return { success: false, error: data || error.message };
    }
};

const scheduleSMS = async (phoneNumber, message, scheduleTime) => {
    try {
        if (!process.env.SMS_API_KEY) {
            return { success: false, error: 'SMS_API_KEY is not configured' };
        }

        const smsApiUrl = 'https://sms.arkesel.com/sms/api';
        
        const params = new URLSearchParams();
        params.append('action', 'send-sms');
        params.append('api_key', process.env.SMS_API_KEY);
        params.append('to', phoneNumber);
        params.append('from', 'Falcon-hive');
        params.append('sms', message);
        params.append('schedule', scheduleTime);

        const response = await axios.post(smsApiUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
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
