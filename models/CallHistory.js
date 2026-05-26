const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CallHistory = sequelize.define('CallHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  caller_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  caller_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  caller_department_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  receiver_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  receiver_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  receiver_department_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  call_type: {
    type: DataTypes.ENUM('audio', 'video', 'department'),
    defaultValue: 'video',
  },
  status: {
    type: DataTypes.ENUM('initiated', 'ringing', 'accepted', 'rejected', 'completed', 'missed', 'failed'),
    defaultValue: 'initiated',
  },
  start_time: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  },
  room_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'call_history',
  timestamps: true,
  indexes: [
    {
      fields: ['caller_id'],
    },
    {
      fields: ['receiver_id'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['createdAt'],
    },
  ],
});

// Calculate duration before saving
CallHistory.beforeSave(async (callHistory, options) => {
  if (callHistory.end_time && callHistory.start_time) {
    const start = new Date(callHistory.start_time);
    const end = new Date(callHistory.end_time);
    callHistory.duration_seconds = Math.floor((end - start) / 1000);
  }
});

module.exports = CallHistory;
