// models/staffFace.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Staff = require('./staff');

const StaffFace = sequelize.define('StaffFace', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  staff_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Staff,
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
    imagePath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  embedding: {
    type: DataTypes.JSON, // store array of numbers
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'StaffFace',
  tableName: 'staff_faces',
  timestamps: false,
});

// Associations
StaffFace.associate = (models) => {
  StaffFace.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
};

module.exports = StaffFace;
