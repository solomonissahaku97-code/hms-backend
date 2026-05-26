const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserGroup = sequelize.define('UserGroup', {
    id: {
        type: DataTypes.INTEGER,

        primaryKey: true,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    // groupId: {
    //     type: DataTypes.INTEGER,
    //     allowNull: false,
    //     references: {
    //         model: 'Groups',
    //         key: 'id'
    //     }
    // }
}, {
    timestamps: true
});


UserGroup.associate = (models) => {
    // UserGroup.belongsTo(models.Staff, { foreignKey: 'userId', as: 'staff' });
    // UserGroup.belongsTo(models.Group, { foreignKey: 'groupId', as: 'group' });
};



module.exports = UserGroup;
