const InstitutionCall = require('../../models/InstitutionCall');
const Chat = require('../../models/Chats');
const Institution = require('../../models/institution');
const Admin = require('../../models/admin');
const Staff = require('../../models/staff');
const InstitutionChatReadReceipt = require('../../models/InstitutionChatReadReceipt');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { upload } = require('../../middlewares/profile_multer');

exports.createInstitutionCall = async (req, res) => {
    try {
        const {
            caller_institution_id,
            receiver_institution_id,
            caller_admin_id,
            receiver_admin_id,
            caller_staff_id,
            receiver_staff_id,
            call_type = 'video',
            notes,
        } = req.body;

        if (!caller_institution_id || !receiver_institution_id) {
            return res.status(400).json({
                success: false,
                message: 'caller_institution_id and receiver_institution_id are required',
            });
        }

        if (caller_institution_id === receiver_institution_id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot call your own institution',
            });
        }

        const caller = await Institution.findByPk(caller_institution_id);
        const receiver = await Institution.findByPk(receiver_institution_id);
        if (!caller || !receiver) {
            return res.status(404).json({ success: false, message: 'Institution not found' });
        }

        const roomName = `inst-call-${uuidv4()}`;

        const call = await InstitutionCall.create({
            caller_institution_id,
            receiver_institution_id,
            caller_admin_id: caller_admin_id || null,
            receiver_admin_id: receiver_admin_id || null,
            caller_staff_id: caller_staff_id || null,
            receiver_staff_id: receiver_staff_id || null,
            call_type,
            status: 'initiated',
            room_name: roomName,
            started_at: null,
            ended_at: null,
            duration_seconds: 0,
            notes: notes || null,
        });

        const populatedCall = await InstitutionCall.findByPk(call.id, {
            include: [
                { model: Institution, as: 'caller_institution', attributes: ['id', 'name', 'contact', 'email'] },
                { model: Institution, as: 'receiver_institution', attributes: ['id', 'name', 'contact', 'email'] },
            ],
        });

        res.status(201).json({
            success: true,
            message: 'Institution call initiated',
            data: populatedCall,
        });
    } catch (error) {
        console.error('Error creating institution call:', error);
        res.status(500).json({ success: false, message: 'Failed to create call', error: error.message });
    }
};

exports.answerInstitutionCall = async (req, res) => {
    try {
        const { id } = req.params;
        const { receiver_admin_id, receiver_staff_id, status } = req.body;

        const call = await InstitutionCall.findByPk(id);
        if (!call) {
            return res.status(404).json({ success: false, message: 'Call not found' });
        }

        if (call.status !== 'initiated' && call.status !== 'ringing') {
            return res.status(400).json({
                success: false,
                message: `Call is already ${call.status} and cannot be answered`,
            });
        }

        call.receiver_admin_id = receiver_admin_id || call.receiver_admin_id;
        call.receiver_staff_id = receiver_staff_id || call.receiver_staff_id;
        call.status = status || 'accepted';
        call.started_at = new Date();

        await call.save();

        res.status(200).json({
            success: true,
            message: `Call ${call.status}`,
            data: call,
        });
    } catch (error) {
        console.error('Error answering institution call:', error);
        res.status(500).json({ success: false, message: 'Failed to answer call', error: error.message });
    }
};

exports.rejectInstitutionCall = async (req, res) => {
    try {
        const { id } = req.params;

        const call = await InstitutionCall.findByPk(id);
        if (!call) {
            return res.status(404).json({ success: false, message: 'Call not found' });
        }

        call.status = 'rejected';
        call.ended_at = new Date();
        await call.save();

        res.status(200).json({ success: true, message: 'Call rejected', data: call });
    } catch (error) {
        console.error('Error rejecting institution call:', error);
        res.status(500).json({ success: false, message: 'Failed to reject call', error: error.message });
    }
};

exports.endInstitutionCall = async (req, res) => {
    try {
        const { id } = req.params;

        const call = await InstitutionCall.findByPk(id);
        if (!call) {
            return res.status(404).json({ success: false, message: 'Call not found' });
        }

        if (call.status === 'completed' || call.status === 'ended') {
            return res.status(400).json({ success: false, message: 'Call is already ended' });
        }

        call.status = 'completed';
        call.ended_at = new Date();

        if (call.started_at) {
            const start = new Date(call.started_at);
            const end = new Date(call.ended_at);
            call.duration_seconds = Math.floor((end - start) / 1000);
        }

        await call.save();

        res.status(200).json({ success: true, message: 'Call ended', data: call });
    } catch (error) {
        console.error('Error ending institution call:', error);
        res.status(500).json({ success: false, message: 'Failed to end call', error: error.message });
    }
};

exports.getInstitutionCallHistory = async (req, res) => {
    try {
        const { institution_id } = req.params;
        const { limit = 20, offset = 0, status, call_type } = req.query;

        const where = {
            [Op.or]: [
                { caller_institution_id: institution_id },
                { receiver_institution_id: institution_id },
            ],
        };

        if (status) where.status = status;
        if (call_type) where.call_type = call_type;

        const calls = await InstitutionCall.findAndCountAll({
            where,
            include: [
                { model: Institution, as: 'caller_institution', attributes: ['id', 'name'] },
                { model: Institution, as: 'receiver_institution', attributes: ['id', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        res.status(200).json({
            success: true,
            data: calls.rows,
            total: calls.count,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
    } catch (error) {
        console.error('Error fetching call history:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch call history', error: error.message });
    }
};

exports.getActiveInstitutionCalls = async (req, res) => {
    try {
        const { institution_id } = req.params;

        const calls = await InstitutionCall.findAll({
            where: {
                [Op.or]: [
                    { caller_institution_id: institution_id },
                    { receiver_institution_id: institution_id },
                ],
                status: { [Op.in]: ['initiated', 'ringing', 'accepted'] },
            },
            include: [
                { model: Institution, as: 'caller_institution', attributes: ['id', 'name'] },
                { model: Institution, as: 'receiver_institution', attributes: ['id', 'name'] },
            ],
            order: [['createdAt', 'DESC']],
        });

        res.status(200).json({ success: true, data: calls });
    } catch (error) {
        console.error('Error fetching active calls:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch active calls', error: error.message });
    }
};

exports.sendInstitutionMessage = async (req, res) => {
    try {
        const {
            sender_institution_id,
            receiver_institution_id,
            sender_admin_id,
            sender_staff_id,
            receiver_admin_id,
            receiver_staff_id,
            text,
            mediaUrl,
            mediaType,
        } = req.body;

        if (!sender_institution_id || !receiver_institution_id) {
            return res.status(400).json({ success: false, message: 'sender_institution_id and receiver_institution_id are required' });
        }

        if (!text && !mediaUrl) {
            return res.status(400).json({ success: false, message: 'Message text or media is required' });
        }

        const message = await Chat.create({
            senderInstitutionId: sender_institution_id,
            receiverInstitutionId: receiver_institution_id,
            senderAdminId: sender_admin_id || null,
            senderId: sender_staff_id || null,
            receiverAdminId: receiver_admin_id || null,
            receiverId: receiver_staff_id || null,
            text: text || null,
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || null,
            institution_id: sender_institution_id,
        });

        const populatedMessage = await Chat.findByPk(message.id, {
            include: [
                { model: Institution, as: 'SenderInstitution', attributes: ['id', 'name'] },
                { model: Institution, as: 'ReceiverInstitution', attributes: ['id', 'name'] },
                { model: Admin, as: 'SenderAdmin', attributes: ['id', 'username'] },
            ],
        });

        res.status(201).json({ success: true, message: 'Message sent', data: populatedMessage });
    } catch (error) {
        console.error('Error sending institution message:', error);
        res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
    }
};

exports.getInstitutionChatHistory = async (req, res) => {
    try {
        const { institution_id } = req.params;
        const { with_institution_id, limit = 50, offset = 0 } = req.query;

        if (!with_institution_id) {
            return res.status(400).json({ success: false, message: 'with_institution_id is required' });
        }

        const where = {
            [Op.or]: [
                { senderInstitutionId: institution_id, receiverInstitutionId: with_institution_id },
                { senderInstitutionId: with_institution_id, receiverInstitutionId: institution_id },
            ],
        };

        const messages = await Chat.findAll({
            where,
            order: [['createdAt', 'ASC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [
                { model: Institution, as: 'SenderInstitution', attributes: ['id', 'name'] },
                { model: Institution, as: 'ReceiverInstitution', attributes: ['id', 'name'] },
                { model: Admin, as: 'SenderAdmin', attributes: ['id', 'username'] },
                { model: Admin, as: 'ReceiverAdmin', attributes: ['id', 'username'] },
            ],
        });

        res.status(200).json({ success: true, data: messages, total: messages.length });
    } catch (error) {
        console.error('Error fetching institution chat history:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chat history', error: error.message });
    }
};

exports.getInstitutionConversations = async (req, res) => {
    try {
        const { institution_id } = req.params;

        const sequelize = Chat.sequelize;

        const conversations = await sequelize.query(`
            SELECT
                CASE WHEN "Chat"."senderInstitutionId" = :institution_id
                    THEN "Chat"."receiverInstitutionId"
                    ELSE "Chat"."senderInstitutionId"
                END AS "partner_institution_id",
                MAX("Chat"."createdAt") AS "lastMessageAt"
            FROM "chats" AS "Chat"
            WHERE "Chat"."senderInstitutionId" = :institution_id
               OR "Chat"."receiverInstitutionId" = :institution_id
            GROUP BY
                CASE WHEN "Chat"."senderInstitutionId" = :institution_id
                    THEN "Chat"."receiverInstitutionId"
                    ELSE "Chat"."senderInstitutionId"
                END
            ORDER BY "lastMessageAt" DESC
        `, {
            replacements: { institution_id },
            type: sequelize.QueryTypes.SELECT,
        });

        const conversationMap = {};
        conversations.forEach(c => {
            if (c.partner_institution_id) {
                conversationMap[c.partner_institution_id] = c.lastMessageAt;
            }
        });

        const allInstitutions = await Institution.findAll({
            where: {
                id: {
                    [Op.ne]: institution_id,
                }
            },
            attributes: ['id', 'name', 'contact', 'email', 'address'],
            order: [['name', 'ASC']],
        });

        const result = allInstitutions.map(inst => ({
            id: inst.id,
            name: inst.name,
            contact: inst.contact,
            email: inst.email,
            address: inst.address,
            lastMessageAt: conversationMap[inst.id] || null,
        }));

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching institution conversations:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch conversations', error: error.message });
    }
};

exports.getUnreadCounts = async (req, res) => {
    try {
        const { institution_id } = req.params;
        const user = req.user;

        if (!user) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const userId = user.id;
        const userType = req.admin ? 'admin' : 'staff';

        const sequelize = Chat.sequelize;

        const partnerInstitutions = await sequelize.query(`
            SELECT DISTINCT
                CASE WHEN "Chat"."senderInstitutionId" = :institution_id
                    THEN "Chat"."receiverInstitutionId"
                    ELSE "Chat"."senderInstitutionId"
                END AS "partner_institution_id"
            FROM "chats" AS "Chat"
            WHERE "Chat"."receiverInstitutionId" = :institution_id
               OR "Chat"."senderInstitutionId" = :institution_id
        `, {
            replacements: { institution_id },
            type: sequelize.QueryTypes.SELECT,
        });

        const unreadCounts = {};

        for (const partner of partnerInstitutions) {
            if (!partner.partner_institution_id) continue;
            if (partner.partner_institution_id === institution_id) continue;

            const receipt = await InstitutionChatReadReceipt.findOne({
                where: {
                    userId,
                    userType,
                    partnerInstitutionId: partner.partner_institution_id
                }
            });

            const lastReadAt = receipt ? receipt.readAt : new Date(0);

            const count = await Chat.count({
                where: {
                    senderInstitutionId: partner.partner_institution_id,
                    receiverInstitutionId: institution_id,
                    createdAt: { [Op.gt]: lastReadAt }
                }
            });

            unreadCounts[partner.partner_institution_id] = count;
        }

        res.status(200).json({ success: true, data: unreadCounts });
    } catch (error) {
        console.error('Error fetching unread counts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch unread counts', error: error.message });
    }
};

exports.markInstitutionMessagesAsRead = async (req, res) => {
    try {
        const { institution_id } = req.params;
        const { partner_institution_id } = req.body;
        const user = req.user;

        if (!user || !partner_institution_id) {
            return res.status(400).json({ success: false, message: 'User and partner institution ID are required' });
        }

        const userId = user.id;
        const userType = req.admin ? 'admin' : 'staff';

        const [receipt, created] = await InstitutionChatReadReceipt.findOrCreate({
            where: {
                userId,
                userType,
                partnerInstitutionId: partner_institution_id
            },
            defaults: {
                userId,
                userType,
                partnerInstitutionId: partner_institution_id,
                readAt: new Date()
            }
        });

        if (!created) {
            await receipt.update({ readAt: new Date() });
        }

        res.status(200).json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark messages as read', error: error.message });
    }
};

exports.uploadInstitutionMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const protocol = req.protocol;
        const host = req.get('host');
        const mediaUrl = req.body.media || `${protocol}://${host}/uploads/${req.file.filename}`;
        const mediaType = req.file.mimetype;

        res.status(200).json({
            success: true,
            data: {
                mediaUrl,
                mediaType,
                fileName: req.file.originalname
            }
        });
    } catch (error) {
        console.error('Error uploading institution media:', error);
        res.status(500).json({ success: false, message: 'Failed to upload media', error: error.message });
    }
};
