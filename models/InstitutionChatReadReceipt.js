const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InstitutionChatReadReceipt = sequelize.define('InstitutionChatReadReceipt', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    userType: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['staff', 'admin']]
        }
    },
    partnerInstitutionId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    readAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'institution_chat_read_receipts',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false
});

module.exports = InstitutionChatReadReceipt;
