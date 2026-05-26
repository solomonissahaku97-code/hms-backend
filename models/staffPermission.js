const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserPermission = sequelize.define('user_permission', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    staff_id: {
        type: DataTypes.UUID,
        // Use string reference 'Staff' instead of model object to avoid circular dependency issues
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    permission_id: {
        type: DataTypes.UUID,
        // Use string reference 'Permission' instead of model object to avoid circular dependency issues
        references: {
            model: 'permissions',
            key: 'id'
        }
    },
},{
    tableName:'user_permission',
    timestamps:true,
})

module.exports = UserPermission;
