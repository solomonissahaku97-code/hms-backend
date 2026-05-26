const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
    
}, {
    tableName: 'roles',
    timestamps: false
},{

});

module.exports = Role;
