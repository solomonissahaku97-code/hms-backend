const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserPermission = sequelize.define('user_permission_new', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    permission_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'permissions',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
}, {
    tableName: 'user_permissions',
    timestamps: false,
    indexes: [
        { unique: true, fields: ['user_id', 'permission_id'] },
    ],
});

UserPermission.associate = (models) => {
    if (models.Permission) {
        UserPermission.belongsTo(models.Permission, { foreignKey: 'permission_id', as: 'permission' });
    }
    if (models.User) {
        UserPermission.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
};

module.exports = UserPermission;
