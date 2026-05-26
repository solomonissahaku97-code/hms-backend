const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    text: {
        type: DataTypes.STRING,
        allowNull: true, // Optional if the message is only media
    },
    mediaUrl: {
        type: DataTypes.STRING,
        allowNull: true, // URL of the uploaded media file
    },
    mediaType: {
        type: DataTypes.STRING,
        allowNull: true, // Type: 'image', 'video', 'audio'
    },
    patientTag: {
        type: DataTypes.STRING,
        allowNull: true, // Tag for referencing patient in messages
    },
    senderId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    receiverId: {
        type: DataTypes.UUID,
        allowNull: true, // For direct messaging
    },
    groupId: {
        type: DataTypes.UUID,
        allowNull: true, // For group messaging
    },
    reaction: {
        type: DataTypes.STRING,
        allowNull: true,  // Store the emoji reaction (e.g., '👍', '❤️', '😂')
    }
}, {
    timestamps: true
});

Message.associate = (models) => {
    Message.hasMany(models.MessageReadReceipt, { foreignKey: 'messageId', as: 'readReceipts' });
    Message.belongsTo(models.Staff, { foreignKey: 'senderId', as: 'sender', onDelete: 'CASCADE', });
};

module.exports = Message;
