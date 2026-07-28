const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Staff = require('./staff');
const Message = require('./messaging');

const MessageReadReceipt = sequelize.define('MessageReadReceipt', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    messageId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    readAt: {
        type: DataTypes.DATE,
        allowNull: false,  // Store the timestamp when the message was read
    }
}, {
    timestamps: true,
    tableName: 'MessageReadReceipts',
});

module.exports = MessageReadReceipt;
