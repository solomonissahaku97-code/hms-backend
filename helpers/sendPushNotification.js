/**
 * Push Notification Helpers
 *
 * NOW DELEGATES TO Firebase Cloud Messaging via the notification-service.
 * The legacy Pusher Beams implementation has been replaced.
 */
const fcm = require('./fcmNotificationHelper');

const sendNotificationToDepartment = async ({ department_id, title, body, institution_id }) => {
    return fcm.sendNotificationToDepartment({ department_id, institution_id, title, body });
};

const sendNotificationToUser = async ({ userId, title, body }) => {
    return fcm.sendNotificationToUser({ userId, title, body });
};

const sendNotificationToAdmin = async ({ adminId, title, body }) => {
    return fcm.sendNotificationToAdmin({ adminId, title, body });
};

module.exports = { 
    sendNotificationToDepartment, 
    sendNotificationToUser, 
    sendNotificationToAdmin 
};
