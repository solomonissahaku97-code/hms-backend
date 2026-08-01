const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const RolePermission = require('./RolePermission');

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false, 
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    tableName: 'roles',
    timestamps: false
});

Role.associate = (models) => {
    Role.belongsToMany(models.Permission, { through: RolePermission, foreignKey: 'role_id', as: 'permissions' });
};

module.exports = Role;
