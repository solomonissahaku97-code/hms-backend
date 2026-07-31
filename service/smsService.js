const axios = require('axios');

const sendSMS = async (phoneNumber, message) => {
    try {
        const smsApiUrl = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${process.env.SMS_API_KEY}&to=${phoneNumber}&from=Tonitel&sms=${encodeURIComponent(message)}`;

        const response = await axios.get(smsApiUrl);

        if (response.data && response.data.code === 'ok') {
            return { success: true, data: response.data };
        } else {
            return { success: false, error: response.data };
        }
    } catch (error) {
        console.error('Error sending SMS:', error.message);
        return { success: false, error: error.message };
    }
};

const scheduleSMS = async (phoneNumber, message, scheduleTime) => {
    try {
        const smsApiUrl = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${process.env.SMS_API_KEY}&to=${phoneNumber}&from=Falcon-hive&sms=${encodeURIComponent(message)}&schedule=${encodeURIComponent(scheduleTime)}`;

        const response = await axios.get(smsApiUrl);

        if (response.data && (response.data.code === 'ok' || response.data.status === 'success')) {
            return { success: true, data: response.data };
        } else {
            return { success: false, error: response.data };
        }
    } catch (error) {
        console.error('Error scheduling SMS:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendSMS, scheduleSMS };
