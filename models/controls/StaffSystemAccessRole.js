// models/staffSystemAccessRole.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const StaffSystemAccessRole = sequelize.define('StaffSystemAccessRole', {
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
  role_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'roles', key: 'id' }
  }
}, {
  tableName: 'staff_system_access_roles',
  timestamps: true
});


StaffSystemAccessRole.associate = (models)=>{
  StaffSystemAccessRole.belongsTo(models.Staff, { foreignKey:'staff_id',as:'staff_access_roles' })

}



module.exports = StaffSystemAccessRole;
