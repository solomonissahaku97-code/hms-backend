const { clients } = require('./authenticateHandler');
const Message = require('../models/messaging');
const { uploadFile } = require('../service/storageService');

const messageHandler = async (ws, messageData) => {
  const { text, senderId, groupId, file, patientTag, messageId, reaction, action } = messageData;
  let mediaUrl = null;

  // Handling message creation (sending a message)
  if (action === 'send') {
    if (file) {
      try {
        // Upload file to Supabase Storage via StorageService
        // file should be a Buffer or have { buffer, originalname, mimetype } from the client
        const fileBuffer = Buffer.isBuffer(file.data)
          ? file.data
          : Buffer.from(file.data, 'base64');

        const uploadResult = await uploadFile({
          fileBuffer,
          fileName: file.name || 'message-attachment',
          mimeType: file.mimetype || 'application/octet-stream',
          institutionId: file.institution_id || null,
          module: 'media',
          subpath: `messages/${groupId || 'dm'}`,
          category: 'image',
        });

        mediaUrl = uploadResult.storagePath;

        // Save the message to the database with the storage path
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
    if (!messageId || !reaction || !groupId) return;

    const message = await Message.findOne({where:{id:messageId,groupId:groupId}});
    if (message) {
      message.reaction = reaction;
      await message.save();

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
    if (!messageId) return;

    const message = await Message.findByPk(messageId);
    if (message) {
      message.reaction = null;
      await message.save();

      clients.forEach(client => {
        if (client.groupId === groupId && client.socket.readyState === ws.OPEN) {
          client.socket.send(JSON.stringify({ event: 'removeReaction', messageId }));
        }
      });
    }
  }

  // Handling delete message
  if (action === 'delete') {
    if (!messageId) return;

    const message = await Message.findByPk(messageId);
    if (message) {
      await message.destroy();

      clients.forEach(client => {
        if (client.groupId === groupId && client.socket.readyState === ws.OPEN) {
          client.socket.send(JSON.stringify({ event: 'deleteMessage', messageId }));
        }
      });
    }
  }
};

module.exports = messageHandler;
