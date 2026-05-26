const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Chat = require('./Chats');
const Department = require('./department');
const Staff = require('./staff');

const ChatReadReceipt = sequelize.define('ChatReadReceipt', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    chatId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Chat,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    departmentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Department,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    staffId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    readAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'chat_read_receipts',
    timestamps: false
});

// Associations
ChatReadReceipt.associate = (models) => {
    ChatReadReceipt.belongsTo(models.Chat, { foreignKey: 'chatId' });
    ChatReadReceipt.belongsTo(models.Department, { foreignKey: 'departmentId' });
    ChatReadReceipt.belongsTo(models.Staff, { foreignKey: 'staffId' });
};

module.exports = ChatReadReceipt;
