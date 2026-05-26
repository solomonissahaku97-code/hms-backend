const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Group = sequelize.define('Group', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'institutions',
            key: 'id'
        }

    }

}, {
    timestamps: true
});

Group.associate = (models) => {
    // Many-to-many relationship between Group and Staff through UserGroup
    Group.belongsToMany(models.Staff, {
        through: 'UserGroup',
        foreignKey: 'groupId',
        otherKey: 'userId',
        as: 'users'
    });

    Group.hasMany(models.Message, { foreignKey: 'groupId', as: 'messages' });
};





module.exports = Group;
