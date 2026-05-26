const axios = require('axios');

const sendSMS = async (phoneNumber, message) => {
    try {
        const smsApiUrl = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${process.env.SMS_API_KEY}&to=${phoneNumber}&from=Tonitel&sms=${encodeURIComponent(message)}`;

        const response = await axios.get(smsApiUrl);
        console.log('API Key:', process.env.SMS_API_KEY);

        console.log(response)

        
        // Handle API response
        if (response.data && response.data.code === 'ok') {
            console.log('SMS sent successfully!');
        } else {
            console.log('Failed to send SMS:', response.data);
        }
    } catch (error) {
        console.error('Error sending SMS:', error);
    }
};

const scheduleSMS = async (phoneNumber, message, scheduleTime) => {
    try {
        const smsApiUrl = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${process.env.SMS_API_KEY}&to=${phoneNumber}&from=Falcon-hive&sms=${encodeURIComponent(message)}&schedule=${encodeURIComponent(scheduleTime)}`;

        const response = await axios.get(smsApiUrl);
        console.log('API Key:', process.env.SMS_API_KEY);

        // Handle API response
        if (response.data && response.data.status === 'success') {
            console.log('Scheduled SMS successfully!');
        } else {
            console.log('Failed to schedule SMS:', response.data);
        }
    } catch (error) {
        console.error('Error scheduling SMS:', error);
    }
};

module.exports = { sendSMS, scheduleSMS };
