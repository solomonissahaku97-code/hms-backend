const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admission = sequelize.define('Admission', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  visit_id: { type: DataTypes.UUID, allowNull: false },
  institution_id: { type: DataTypes.UUID, allowNull: false },
  staff_id: { type: DataTypes.UUID, allowNull: false },
  patient_id: { type: DataTypes.UUID, allowNull: true },
  admission_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  discharge_date: { type: DataTypes.DATE, allowNull: true },
  department_id: { type: DataTypes.UUID, allowNull: true },
  bed_id: { type: DataTypes.UUID, allowNull: true },
  bed_number: { type: DataTypes.STRING, allowNull: true },
  status: {
    type: DataTypes.ENUM('Admitted', 'Discharged', 'Transferred'),
    allowNull: false, defaultValue: 'Admitted',
  },
  admission_status: {
    type: DataTypes.ENUM('pending', 'active', 'critical', 'stable', 'improving'),
    defaultValue: 'pending',
  },
  note: { type: DataTypes.TEXT, allowNull: true },
}, {
  sequelize,
  modelName: 'Admission',
  tableName: 'admissions',
  timestamps: true,
});

Admission.associate = (models) => {
  if (models.Visit) Admission.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
  if (models.Institution) Admission.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
  if (models.Staff) Admission.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
  if (models.Bed) Admission.belongsTo(models.Bed, { foreignKey: 'bed_id', as: 'bed' });
};

module.exports = Admission;
