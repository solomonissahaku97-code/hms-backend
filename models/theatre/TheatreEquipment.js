const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const TheatreEquipment = sequelize.define('TheatreEquipment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  serial_number: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  model: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  category: {
    type: DataTypes.ENUM(
      'imaging',
      'monitoring',
      'surgical',
      'sterilization',
      'anesthesia',
      'support',
      'other'
    ),
    allowNull: false,
    defaultValue: 'other',
  },
  status: {
    type: DataTypes.ENUM(
      'available',
      'in-use',
      'maintenance',
      'retired',
      'out-of-service'
    ),
    allowNull: false,
    defaultValue: 'available',
  },
  room_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Current room where equipment is located',
  },
  purchase_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  warranty_expiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_maintenance_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  next_maintenance_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  maintenance_history: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of maintenance records',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_portable: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  manufacturer: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'theatre_equipment',
  timestamps: true,
  underscored: true,
});

TheatreEquipment.associate = (models) => {
  TheatreEquipment.belongsTo(models.OperatingRoom, {
    foreignKey: 'room_id',
    as: 'room',
  });
};

module.exports = TheatreEquipment;

