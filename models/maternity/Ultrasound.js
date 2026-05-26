// models/maternity/Ultrasound.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Ultrasound = sequelize.define('Ultrasound', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  visit_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'visits',
      key: 'id',
    },
  },
  department_id:{
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'departments',
      key: 'id',
    },
  },
  gestational_age: {
    type: DataTypes.INTEGER, // weeks
    allowNull: true,
  },
  scan_type: {
    type: DataTypes.ENUM('Transabdominal', 'Transvaginal'),
    allowNull: false,
    defaultValue: 'Transabdominal',
  },
  indication: {
    type: DataTypes.STRING, // reason for scan
    allowNull: true,
  },
  findings: {
    type: DataTypes.JSON, // structured results
    allowNull: true,
  },
  conclusion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  images: {
    type: DataTypes.ARRAY(DataTypes.STRING), // paths to uploaded scan images
    allowNull: true,
  },
  performed_by: {
    type: DataTypes.UUID,
    references: {
      model: 'staffs',
      key: 'id',
    },
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'ultrasounds',
  timestamps: true,
});


Ultrasound.associate = (models)=>{
    Ultrasound.belongsTo(models.Visit, { foreignKey:'visit_id',as:'visit' }),
    Ultrasound.belongsTo(models.Staff, { foreignKey:'performed_by',as:'staff' }),
    Ultrasound.belongsTo(models.Department, { foreignKey:'department_id',as:'department' })
}

module.exports = Ultrasound;
