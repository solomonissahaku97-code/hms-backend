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

UserPermission.associate = (models) => {
    if (models.Permission) {
        UserPermission.belongsTo(models.Permission, { foreignKey: 'permission_id', as: 'permission' });
    }
    if (models.Staff) {
        UserPermission.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
    }
};

module.exports = UserPermission;
