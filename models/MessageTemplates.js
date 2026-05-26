const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MessageTemplate = sequelize.define('MessageTemplate', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Content of the message template',
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    }


}, {
    timestamps: true
});

module.exports = MessageTemplate;
