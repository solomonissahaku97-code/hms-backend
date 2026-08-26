const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserIdMapping = sequelize.define('UserIdMapping', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    old_table: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    old_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    new_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    migrated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'user_id_mapping',
    timestamps: false,
    indexes: [
        { unique: true, fields: ['old_table', 'old_id'] },
    ],
});

module.exports = UserIdMapping;
