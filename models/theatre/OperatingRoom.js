// models/theatre/OperatingRoom.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const OperatingRoom = sequelize.define('OperatingRoom', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  room_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  room_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  room_type: {
    type: DataTypes.ENUM('general', 'cardiac', 'neuro', 'orthopedic', 'vascular', 'ENT', 'ophthalmic', 'urology', 'plastic', 'trauma'),
    allowNull: false,
    defaultValue: 'general',
  },
  status: {
    type: DataTypes.ENUM('available', 'occupied', 'cleaning', 'maintenance', 'out_of_service'),
    allowNull: false,
    defaultValue: 'available',
  },
  current_patient_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  current_booking_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
  },
  equipment: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
  },
  department_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  floor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  building: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_emergency_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'operating_rooms',
  timestamps: true,
  underscored: true,
});

OperatingRoom.associate = (models) => {
  OperatingRoom.belongsTo(models.Department, {
    foreignKey: 'department_id',
    as: 'department',
  });
  // Note: The reverse relationship (OperatingRoom -> TheatrePatients) is not needed
  // because TheatrePatients already has a belongsTo OperatingRoom via 'room_id'
  // This was causing a sync error because Sequelize tried to create FK before the target table existed
};

module.exports = OperatingRoom;

