const { Op } = require('sequelize');
const Chat = require('../models/Chats');
const sequelize = require('../config/database');
const Staff = require('../models/staff');
const Department = require('../models/department');
const Admin = require('../models/admin');
const { sendNotificationToDepartment,sendNotificationToAdmin,sendNotificationToUser } = require("../helpers/sendPushNotification");
const { createNotification } = require("../helpers/notificationService");
const WebSocket = require('ws'); // Add this at the top of the file


async function getRecentChats(userId, departmentId, isAdmin = false) {
    const whereCondition = {
        [Op.or]: [
            { senderId: userId },
            { receiverId: userId },
            { senderDepartmentId: departmentId },
            { receiverDepartmentId: departmentId },
        ],
    };

    // If the user is an admin, also fetch messages where adminId matches
    if (isAdmin) {
        whereCondition[Op.or].push({ adminId: userId });
    }

    const recentChats = await Chat.findAll({
        where: whereCondition,
        include: [
            {
                model: Staff,
                as: "Sender",
            },
            {
                model: Staff,
                as: "Receiver",
            },
            {
                model: Admin, // Include Admin model for admin messages
                as: "SenderAdmin",
            }
        ],
        attributes: [
            "id",
            "text",
            "mediaUrl",
            "createdAt",
            "senderId",
            "receiverId",
            "senderDepartmentId",
            "receiverDepartmentId",
        ],
        order: [["createdAt", "DESC"]],
        group: ["Chat.id", "Sender.id","Receiver.id","SenderAdmin.id"],
    });

    return recentChats;
}

 

async function sendMessage(req, res) {
    const { senderId, receiverId, text, senderDepartmentId, receiverDepartmentId, adminId, institution_id } = req.body;

    try {
        if (!senderId && !adminId && !senderDepartmentId) {
            return res.status(400).json({ success: false, message: "Sender is required." });
        }

        if (!receiverId && !receiverDepartmentId) {
            return res.status(400).json({ success: false, message: "Receiver is required." });
        }

        // Create the chat message
        const message = await Chat.create({
            senderId, 
            senderAdminId: adminId,  
            senderDepartmentId,
            receiverId,
            receiverDepartmentId,
            text,
            institution_id
        });

        const messageData = {
            senderId,
            receiverId,
            senderDepartmentId,
            receiverDepartmentId,
            adminId,
            text,
            createdAt: message.createdAt
        };
 
        // Get WebSocket server from app
        const wss = req.app.get('ws');

        // Send WebSocket message to all clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ 
                    type: "new_message", 
                    data: messageData 
                }));
            }
        });

        return res.status(201).json({ success: true, message });
    } catch (error) {
        console.error("Error sending message:", error);
        return res.status(500).json({ success: false, message: "Failed to send message" });
    }
}



async function getDepartmentsByInstitution(req, res) {
    const { institution_id } = req.query; // Get institution ID from request parameters

    try {
        if (!institution_id) {
            return res.status(400).json({ success: false, message: "Institution ID is required." });
        }

        const departments = await Department.findAll({
            where: { institution_id },
            attributes: ['id', 'name'] // Fetch only necessary fields
        });

        return res.status(200).json({ success: true, departments });
    } catch (error) {
        console.error('Error fetching departments:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch departments' });
    }
}





module.exports = { getRecentChats,sendMessage,getDepartmentsByInstitution };
