const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Permission = sequelize.define('Permission', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.STRING }
}, { tableName: 'permissions' });

Permission.associate = (models) => {
    Permission.belongsToMany(models.Role, { through: models.RolePermission, foreignKey: 'permission_id', as: 'roles' });
};

module.exports = Permission;
