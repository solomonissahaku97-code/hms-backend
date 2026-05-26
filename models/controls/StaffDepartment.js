
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const StaffDepartment = sequelize.define('StaffDepartment', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  staff_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'staffs', key: 'id' }
  },
  department_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'departments', key: 'id' }
  },
  access_type: {
    type: DataTypes.ENUM('full access', 'view only access'),
    defaultValue: 'full access',
    allowNull: true
  },
  primary_department: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: true
  }
}, {
  tableName: 'staff_departments',
  timestamps: true
});

StaffDepartment.associate = (models) => {
  StaffDepartment.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
  StaffDepartment.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
};


module.exports = StaffDepartment;
