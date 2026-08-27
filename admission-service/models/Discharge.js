const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Discharge = sequelize.define('Discharge', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  patient_id: { type: DataTypes.UUID, allowNull: false },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  doctor_id: { type: DataTypes.UUID, allowNull: false },
  institution_id: { type: DataTypes.UUID, allowNull: true },
  discharge_date: { type: DataTypes.DATE, allowNull: false },
  type: {
    type: DataTypes.ENUM('routine', 'ama', 'transfer', 'expired'),
    allowNull: false,
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  // Routine
  follow_up_date: { type: DataTypes.DATE, allowNull: true },
  instructions: { type: DataTypes.TEXT, allowNull: true },
  // AMA
  ama_reason: { type: DataTypes.TEXT, allowNull: true },
  risks_acknowledged: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
  // Transfer
  facility_name: { type: DataTypes.STRING, allowNull: true },
  transfer_reason: { type: DataTypes.STRING, allowNull: true },
  // Expired
  time_of_death: { type: DataTypes.DATE, allowNull: true },
  cause_of_death: { type: DataTypes.STRING, allowNull: true },
  death_certificate_number: { type: DataTypes.STRING, allowNull: true },
  // Status
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
    defaultValue: 'completed',
  },
}, {
  sequelize,
  modelName: 'Discharge',
  tableName: 'discharges',
  timestamps: true,
  underscored: true,
});

Discharge.associate = (models) => {
  if (models.Visit) Discharge.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
  if (models.Staff) Discharge.belongsTo(models.Staff, { foreignKey: 'doctor_id', as: 'doctor' });
};

module.exports = Discharge;
