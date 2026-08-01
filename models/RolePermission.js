const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    role_id: { type: DataTypes.UUID, allowNull: false },
    permission_id: { type: DataTypes.UUID, allowNull: false }
}, { tableName: 'role_permissions' });

RolePermission.associate = (models) => {
    RolePermission.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
    RolePermission.belongsTo(models.Permission, { foreignKey: 'permission_id', as: 'permission' });
};

module.exports = RolePermission;
