const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Bed = sequelize.define('Bed', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  bed_number: { type: DataTypes.STRING, allowNull: false },
  department_id: { type: DataTypes.UUID, allowNull: true },
  institution_id: { type: DataTypes.UUID, allowNull: false },
  status: {
    type: DataTypes.ENUM('available', 'occupied', 'faulty', 'under_maintenance'),
    defaultValue: 'available',
  },
  is_occupied: { type: DataTypes.BOOLEAN, defaultValue: false },
  visit_id: { type: DataTypes.UUID, allowNull: true },
}, {
  sequelize,
  modelName: 'Bed',
  tableName: 'beds',
  timestamps: true,
});

Bed.associate = (models) => {
  if (models.Department) Bed.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
  if (models.Institution) Bed.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
  if (models.Visit) Bed.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
};

module.exports = Bed;
