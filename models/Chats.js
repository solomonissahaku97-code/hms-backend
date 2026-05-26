const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Staff = require('./staff');
const Department = require('./department');
const Admin = require('./admin'); // ✅ Import Admin model

const Chat = sequelize.define('Chat', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    senderDepartmentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Department,
            key: 'id'
        },
        onDelete: 'SET NULL',
        index: true,
    },
    receiverDepartmentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Department,
            key: 'id'
        },
        onDelete: 'SET NULL',
        index: true,
    },
    senderId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    receiverId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    senderAdminId: {  // ✅ New field for Admin sender
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Admin,
            key: 'id'
        }
    },
    receiverAdminId: { // ✅ New field for Admin receiver
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Admin,
            key: 'id'
        }
    },
    text: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mediaUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mediaType: {
        type: DataTypes.STRING,
        allowNull: true
    },
    patientTag: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'chats',
    timestamps: true
});

// ✅ Associations
Chat.associate = (models) => {
    Chat.belongsTo(models.Institution, { foreignKey: 'institution_id' });
    Chat.belongsTo(models.Department, { as: 'SenderDepartment', foreignKey: 'senderDepartmentId' });
    Chat.belongsTo(models.Department, { as: 'ReceiverDepartment', foreignKey: 'receiverDepartmentId' });
    Chat.belongsTo(models.Staff, { as: 'Sender', foreignKey: 'senderId', onDelete: 'CASCADE' });
    Chat.belongsTo(models.Staff, { as: 'Receiver', foreignKey: 'receiverId', onDelete: 'CASCADE' });
    Chat.hasMany(models.ChatReadReceipt, { foreignKey: 'chatId', as: 'readReceipts' });

    // ✅ Admin Associations
    Chat.belongsTo(models.Admin, { foreignKey: "senderAdminId", as: "SenderAdmin" });
    Chat.belongsTo(models.Admin, { foreignKey: "receiverAdminId", as: "ReceiverAdmin" });
};

module.exports = Chat;
