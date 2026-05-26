const { Op } = require('sequelize');
const Chat = require('../models/Chats');
const Staff = require('../models/staff');
const Department = require('../models/department');
const Admin = require('../models/admin');
const ChatReadReceipt = require('../models/ChatReadReceipt');

class ChatService {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`New chat connection: ${socket.id}`);

      // Join room for private messaging
      socket.on('join-chat-room', async ({ userId, departmentId }) => {
        if (userId) socket.join(`user-${userId}`);
        if (departmentId) socket.join(`department-${departmentId}`);
        console.log(`User ${userId} joined chat rooms`);
      });

      // Send message handler
      socket.on('send-message', async (messageData, callback) => {
        try {
          const savedMessage = await this.saveMessageToDatabase(messageData);
          this.distributeMessage(savedMessage);
          callback({
            success: true,
            messageId: savedMessage.id
          });
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('message-error', { error: 'Failed to send message' });
          callback({
            success: false,
            error: 'Failed to save message'
          });
        }
      });

      // Mark messages as read
      socket.on('mark-as-read', async ({ messageIds, readerId }) => {
        await this.handleReadReceipts(messageIds, readerId);
      });
    });
  }

  async saveMessageToDatabase(messageData) {
    console.log(messageData)
    const message = await Chat.create({
      institution_id: messageData.institution_id,
      senderDepartmentId: messageData.senderDepartmentId,
      receiverDepartmentId: messageData.receiverDepartmentId,
      senderId: messageData.senderId,
      receiverId: messageData.receiverId,
      senderAdminId: messageData.senderAdminId,
      receiverAdminId: messageData.receiverAdminId,
      text: messageData.text,
      mediaUrl: messageData.mediaUrl,
      mediaType: messageData.mediaType,
      patientTag: messageData.patientTag
    });

    // Fetch the message with associations for notification
    const messageWithAssociations = await Chat.findByPk(message.id, {
      include: [
        { model: Staff, as: 'Sender' },
        { model: Staff, as: 'Receiver' },
        { model: Department, as: 'SenderDepartment' },
        { model: Department, as: 'ReceiverDepartment' },
        { model: Admin, as: 'SenderAdmin' }
      ]
    });

    if (messageData.receiverId) {
      await ChatReadReceipt.create({
        chatId: message.id,
        departmentId: messageData.receiverDepartmentId,
        staffId: messageData.receiverId,
        readAt: null
      });
    }

    return messageWithAssociations;
  }

  async distributeMessage(message) {
    console.log('Distributing message:', message.id);

    // Send to specific user if receiverId exists
    if (message.receiverId) {
      console.log(`Sending to user-${message.receiverId}`);
      this.io.to(`user-${message.receiverId}`).emit('new-message', message);
    }

    // For department-wide messages - send to receiver's department
    if (message.receiverDepartmentId) {
      console.log(`Sending to department-${message.receiverDepartmentId}`);
      this.io.to(`department-${message.receiverDepartmentId}`).emit('new-department-message', message);
      
      // Get sender name
      let senderName = 'Unknown';
      if (message.Sender) {
        senderName = message.Sender.firstName ? 
          `${message.Sender.firstName} ${message.Sender.lastName || ''}` : 'Staff';
      } else if (message.SenderAdmin) {
        senderName = 'Admin';
      }

      // Get sender department name
      let senderDepartmentName = 'Unknown Department';
      if (message.SenderDepartment) {
        senderDepartmentName = message.SenderDepartment.name;
      } else if (message.senderDepartmentId) {
        // Try to fetch department if not included
        try {
          const dept = await Department.findByPk(message.senderDepartmentId);
          if (dept) {
            senderDepartmentName = dept.name;
          }
        } catch (e) {
          console.log('Could not fetch department:', e);
        }
      }

      // Emit notification event with department info for toast notifications
      this.io.to(`department-${message.receiverDepartmentId}`).emit('department-message-notification', {
        id: message.id,
        text: message.text,
        senderDepartmentId: message.senderDepartmentId,
        senderDepartmentName: senderDepartmentName,
        senderName: senderName,
        receiverDepartmentId: message.receiverDepartmentId,
        timestamp: message.createdAt
      });
    }

    // Also send back to sender's department so they can see their own messages in the chat
    if (message.senderDepartmentId) {
      console.log(`Sending to sender's department-${message.senderDepartmentId}`);
      this.io.to(`department-${message.senderDepartmentId}`).emit('new-department-message', message);
    }

    // Send confirmation to the sender (user room)
    if (message.senderId) {
      this.io.to(`user-${message.senderId}`).emit('message-sent', {
        ...message.toJSON(),
        status: 'delivered'
      });
    }
  }

  async handleReadReceipts(messageIds, readerId) {
    await ChatReadReceipt.update(
      { readAt: new Date() },
      { where: { chatId: messageIds, staffId: readerId } }
    );

    // Optional: notify sender about read status
    messageIds.forEach((id) => {
      this.io.emit('message-read', { messageId: id, readerId });
    });
  }

  async getUnreadCount(staffId, departmentId) {
    const count = await ChatReadReceipt.count({
      where: {
        staffId,
        departmentId,
        readAt: null
      }
    });
    return count;
  }



  // In ChatService.js
  async getChatHistory({ userId, departmentId, limit = 50 }) {
    const where = {
      [Op.or]: [
        { receiverId: userId },
        { senderId: userId },
        { receiverDepartmentId: departmentId },
        { senderDepartmentId: departmentId }
      ]
    };

    return await Chat.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      include: [
        { model: Staff, as: 'Sender' },
        { model: Staff, as: 'Receiver' },
        { model: Department, as: 'SenderDepartment' },
        { model: Department, as: 'ReceiverDepartment' }
      ]
    });
  }
}

module.exports = ChatService;

