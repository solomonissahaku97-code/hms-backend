const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Department = require('./department');
const Staff = require('./staff');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,

    defaultValue: DataTypes.UUIDV4
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  video_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  from_department_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Department,
      key: 'id',
    },
  },
  to_department_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Department,
      key: 'id',
    },
  },
  from_staff_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Staff,
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  to_staff_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Staff,
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  type: {
    type: DataTypes.ENUM('Alert', 'Message', 'Reminder', 'System', 'Comment'),
    defaultValue: 'Message',
  },
  broadcast: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  priority: {
    type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'),
    defaultValue: 'Low',
  },
  status: {
  type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed'),
  defaultValue: 'sent',
},

}, {
  timestamps: true,
  tableName: 'notifications',
});
Notification.associate = (models) => {
  Notification.belongsTo(models.Staff, { as: 'fromStaff', foreignKey: 'from_staff_id', onDelete: 'CASCADE' });
  Notification.belongsTo(models.Staff, { as: 'toStaff', foreignKey: 'to_staff_id', onDelete: 'CASCADE' });
  Notification.belongsTo(models.Department, { as: 'fromDepartment', foreignKey: 'from_department_id' });
  Notification.belongsTo(models.Department, { as: 'toDepartment', foreignKey: 'to_department_id' });
};


module.exports = Notification;
