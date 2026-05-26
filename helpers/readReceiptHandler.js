const { Op } = require('sequelize'); // Import Op for Sequelize operators
const MessageReadReceipt = require('../models/MessageReadReceipt');
const Message = require('../models/messaging');

const readReceiptHandler = async (ws, messageData, clients) => {
  const { userId, groupId } = messageData;

  console.log('DATA=====', messageData);

  try {
    if (!userId || !groupId) {
      ws.send(
        JSON.stringify({
          event: 'error',
          message: 'Invalid data for readReceipt event.',
        })
      );
      return;
    }

    // Fetch all read message IDs for the user
    const readMessageReceipts = await MessageReadReceipt.findAll({
      attributes: ['messageId'],
      where: { userId },
      raw: true, // Fetch plain objects
    });

    const readMessageIds = readMessageReceipts.map((receipt) => receipt.messageId);

    console.log('Read Message IDs:', readMessageIds);

    // Fetch all unread messages for the group
    const whereClause = {
      groupId,
    };

    if (readMessageIds.length > 0) {
      whereClause.id = { [Op.notIn]: readMessageIds }; // Exclude already read messages
    }

    const unreadMessages = await Message.findAll({
      where: whereClause,
    });

    console.log('Unread Messages:', unreadMessages);

    // Mark all fetched messages as read for the user
    await Promise.all(
      unreadMessages.map(async (message) => {
        await MessageReadReceipt.findOrCreate({
          where: { messageId: message.id, userId },
          defaults: { 
            messageId: message.id, 
            userId, 
            readAt: new Date() // Add the current timestamp
          },
        });
      })
    );
    

    // Broadcast updated read receipts
    clients.forEach((client) => {
      if (client.socket.readyState === ws.OPEN) {
        client.socket.send(
          JSON.stringify({
            event: 'readReceiptUpdated',
            groupId,
            userId,
            messageIds: unreadMessages.map((message) => message.id),
          })
        );
      }
    });
  } catch (error) {
    console.error('Error in readReceiptHandler:', error);
    ws.send(
      JSON.stringify({
        event: 'error',
        message: 'Failed to process read receipt.',
      })
    );
  }
};

module.exports = readReceiptHandler;
