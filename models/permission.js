const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');



const Permission = sequelize.define('Permission', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING, allowNull: false, unique: true }, // e.g. can_edit_vitals
    description: { type: DataTypes.STRING }
}, { tableName: 'permissions' });

// models/rolePermission.js
const RolePermission = sequelize.define('RolePermission', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    role_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'roles', key: 'id' } },
    permission_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'permissions', key: 'id' } }
}, { tableName: 'role_permissions' });
RolePermission.associate = (models) => {
    RolePermission.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
    RolePermission.belongsTo(models.Permission, { foreignKey: 'permission_id', as: 'permission' });
};
module.exports = { Permission, RolePermission };