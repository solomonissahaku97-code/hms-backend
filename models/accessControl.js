const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AccessControl = sequelize.define('AccessControl', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,

  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
}, {
  timestamps: true,
});
AccessControl.associate = (models) => {
  AccessControl.belongsToMany(models.Department, {
    through: 'DepartmentAccessControl',
    as: 'departments',
    foreignKey: 'accessControl_id',
    otherKey: 'department_id',
  });
};

module.exports = AccessControl;
