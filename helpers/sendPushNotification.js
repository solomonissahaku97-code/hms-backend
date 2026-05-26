const beamsClient = require("../config/pusher");
const Staff = require("../models/staff");
const Admin = require("../models/admin");

const sendNotificationToDepartment = async ({ department_id, title, body, institution_id }) => {
    try {
        const users = await Staff.findAll({
            where: { department_id, institution_id },
            attributes: ["id"],
        });

        const interests = users.map(user => `user-${user.id}`);

        if (interests.length === 0) {
            console.log("No users found in this department.");
            return;
        }

        const response = await beamsClient.publishToInterests(interests, {
            apns: { aps: { alert: { title, body, sound: "default" } } },
            fcm: { notification: { title, body, sound: "default" } },
            web: { notification: { title, body } },
        });

        console.log("Notification sent to department:", response);
    } catch (error) {
        console.error("Error sending department notification:", error);
    }
};

const sendNotificationToUser = async ({ userId, title, body }) => {
    try {
        const interest = `user-${userId}`;

        const response = await beamsClient.publishToInterests([interest], {
            apns: { aps: { alert: { title, body, sound: "default" } } },
            fcm: { notification: { title, body, sound: "default" } },
            web: { notification: { title, body } },
        });

        console.log(`Notification sent to user ${userId}:`, response);
    } catch (error) {
        console.error("Error sending user notification:", error);
    }
};

const sendNotificationToAdmin = async ({ adminId, title, body }) => {
    try {
        const interest = `admin-${adminId}`;

        const response = await beamsClient.publishToInterests([interest], {
            apns: { aps: { alert: { title, body, sound: "default" } } },
            fcm: { notification: { title, body, sound: "default" } },
            web: { notification: { title, body } },
        });

        console.log(`Notification sent to admin ${adminId}:`, response);
    } catch (error) {
        console.error("Error sending admin notification:", error);
    }
};

module.exports = { 
    sendNotificationToDepartment, 
    sendNotificationToUser, 
    sendNotificationToAdmin 
};
