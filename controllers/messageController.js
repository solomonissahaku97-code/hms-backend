const MessageReadReceipt = require('../models/MessageReadReceipt');
const path = require('path');
const Staff = require('../models/staff');
const Role = require('../models/role');
const { Op } = require('sequelize');
const Message = require('../models/messaging');
const Group = require('../models/group'); // Assuming you have a Group model
const { Sequelize } = require('sequelize');


// Create a message and broadcast via WebSocket
exports.createMessage = async (req, res) => {
  try {
      const { text, senderId, receiverId, groupId } = req.body;
      let mediaUrl = null;
      let mediaType = null;

      // If a media file is uploaded, handle it
      if (req.file) {
          mediaUrl = path.join('/uploads/logos', req.file.filename); // Store the media URL
          mediaType = req.file.mimetype.split('/')[0]; // Extract media type, e.g., 'image'
      }

      // Create the message
      const message = await Message.create({
          text,
          mediaUrl,
          mediaType,
          senderId,
          receiverId,
          groupId
      });

      // Emit the message via WebSocket (req.io is used to access WebSocket instance)
      req.io.emit('receiveMessage', message);  // Emit the message to all clients or a room

      res.status(201).json({ message });
  } catch (error) {
      console.error('Fipmanailed to send message:', error);
      res.status(500).json({ error: 'Failed to send message' }); 
  }
};

// Fetch all messages for a group or user
exports.getMessages = async (req, res) => {
  try {
    const { groupId, userId } = req.query;

    const condition = {};
    if (groupId) {
      condition.groupId = groupId;
    } else if (userId) {
      condition.receiverId = userId;
    }

    const messages = await Message.findAll({
      where: condition,
      order: [['createdAt', 'ASC']],
        include:[ 
          {
            model:Staff,
            as:'sender',
            include:[
              {
                model:Role,
                as:'role'
              }
            ]
          },
          {
            model:MessageReadReceipt,
            as:'readReceipts'
          },
        ]  
    },);
  
   return res.status(200).json({ data: messages });
  } catch (error) {
   return res.status(500).json({ error: error.message });
  }
};


exports.getUnreadMessagesByUser = async (userId, institutionId = null) => {
  try {
    const groups = await Group.findAll({
      where: {
        institution_id: institutionId || { [Op.not]: null },
      },
      attributes: ['id', 'name'],
      include: {
        model: Staff,
        where: { id: userId }, // Adjusted to match Staff's id field
        attributes: [],
        through: { attributes: [] }, // Exclude join table attributes
        as:'users'
      },
    });

    if (!groups.length) {
      return { count: 0, groups: [] };
    }

    const groupUnreadCounts = await Promise.all(
      groups.map(async (group) => {
        const unreadMessagesCount = await Message.count({
          where: {
            groupId: group.id,
            id: {
              [Op.notIn]: Sequelize.literal(
                `(SELECT "messageId" FROM "MessageReadReceipts" WHERE "userId" = ${userId})`
              )              
            },
          },
        });

        return {
          groupId: group.id,
          groupName: group.name,
          unreadCount: unreadMessagesCount,
        };
      })
    );

    const totalUnreadCount = groupUnreadCounts.reduce(
      (sum, group) => sum + group.unreadCount,
      0
    );

    return {
      count: totalUnreadCount,
      groups: groupUnreadCounts,
    };
  } catch (error) {
    console.error('Error in getUnreadMessagesByUser:', error);
    throw new Error('Failed to fetch unread messages.');
  }
};





exports.markMessageAsRead = async (req, res) => {
  try {
      const { messageId, userId } = req.body;

      // Check if the read receipt already exists
      const receipt = await MessageReadReceipt.findOne({
          where: {
              messageId,
              userId
          }
      });

      if (!receipt) {
          // Create a new read receipt
          await MessageReadReceipt.create({
              messageId,
              userId,
              readAt: new Date()  // Store the current timestamp
          });
      }

      return res.status(200).json({ message: 'Message marked as read' });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
};