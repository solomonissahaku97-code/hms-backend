const { clients } = require('./authenticateHandler');
const Message = require('../models/messaging');
const { uploadToFirebase } = require('../middlewares/profile_multer')


const messageHandler = async (ws, messageData) => {
  const { text, senderId, groupId, file, patientTag, messageId, reaction, action } = messageData;
  let mediaUrl = null;

  // Handling message creation (sending a message)
  if (action === 'send') {
    if (file) {
      try {
        // Use the uploadToFirebase logic to handle the file
        const req = { file }; // Mocking the request object
        const res = {};
         uploadToFirebase('file')(req, res, async () => {
          mediaUrl = req.file.firebaseUrl;

          // Save the message to the database with the file URL
          const message = await Message.create({
            text,
            senderId,
            groupId,
            mediaUrl,
            patientTag
          });

          // Broadcast the message to all connected clients in the group
          clients.forEach((client) => {
            if (client.socket.readyState === ws.OPEN) {
              client.socket.send(
                JSON.stringify({ event: 'receiveMessage', message })
              );
            }
          });
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        return ws.send(
          JSON.stringify({ event: 'error', message: 'Failed to upload file' })
        );
      }
    } else {
      // Save a text-only message to the database
      const message = await Message.create({ text, senderId, groupId });

      // Notify all connected clients about the new text message
      clients.forEach((client) => {
        if (client.socket.readyState === ws.OPEN) {
          client.socket.send(
            JSON.stringify({ event: 'receiveMessage', message })
          );
        }
      });
    }
  }


  // Handling add reaction to a message
  if (action === 'addReaction') {
    if (!messageId || !reaction || !groupId) return; // Ensure messageId and reaction are provided

    const message = await Message.findOne({where:{id:messageId,groupId:groupId}});
    if (message) {
      // Update the message's reaction field
      message.reaction = reaction;
      await message.save();

      // Notify clients in the group about the updated message reaction
      clients.forEach(client => {
        if (client.groupId === groupId && client.socket.readyState === ws.OPEN) {
          client.socket.send(JSON.stringify({ event: 'updateReaction', message:`${senderId} has reacted to your message` }));
        }
      });
    }else{
      console.log('bad entering')
    }
  }

  // Handling remove reaction from a message
  if (action === 'removeReaction') {
    if (!messageId) return; // Ensure messageId is provided

    const message = await Message.findByPk(messageId);
    if (message) {
      // Reset the reaction field to null or empty string
      message.reaction = null;
      await message.save();

      // Notify clients in the group that the reaction was removed
      clients.forEach(client => {
        if (client.groupId === groupId && client.socket.readyState === ws.OPEN) {
          client.socket.send(JSON.stringify({ event: 'removeReaction', messageId }));
        }
      });
    }
  }

  // Handling delete message
  if (action === 'delete') {
    if (!messageId) return; // Ensure messageId is provided

    const message = await Message.findByPk(messageId);
    if (message) {
      // Delete the message from the database
      await message.destroy();

      // Notify clients in the group about the deleted message
      clients.forEach(client => {
        if (client.groupId === groupId && client.socket.readyState === ws.OPEN) {
          client.socket.send(JSON.stringify({ event: 'deleteMessage', messageId }));
        }
      });
    }
  }
};

module.exports = messageHandler;
