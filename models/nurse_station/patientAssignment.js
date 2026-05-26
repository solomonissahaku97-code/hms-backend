// models/patientAssignment.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const PatientAssignment = sequelize.define('PatientAssignment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nurse_id: {
    type: DataTypes.UUID,
    allowNull: false,
    reference:{
        model:'staffs',
        key:'id'
    }
  },
  visit_id: {
    type: DataTypes.UUID,
    allowNull: false,
    reference:{
        model:'visits',
        key:'id'
    }
  },
  department_id:{
    type: DataTypes.UUID,
    allowNull: false,
    reference:{
        model:'departments',
        key:'id'
    }
  },
  shift: {
    type: DataTypes.ENUM('morning', 'afternoon', 'night'),
    allowNull: false
  },
  assigned_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  released_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'patient_assignments',
  timestamps: true
});

// association
PatientAssignment.associate = (models)=>{
    PatientAssignment.belongsTo(models.Staff, { foreignKey: 'nurse_id', as: 'nurse' });
    PatientAssignment.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
}

module.exports = PatientAssignment;
