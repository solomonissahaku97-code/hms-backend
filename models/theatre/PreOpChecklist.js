// models/theatre/PreOpChecklist.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Staff = require('../staff');
const TheatrePatients = require('./TheatrePatients');

const PreOpChecklist = sequelize.define('PreOpChecklist', {
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

  surgery_schedule_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: TheatrePatients,
      key: 'id',
    },
  },

  // ✅ JSON field stores the entire checklist structure
  checklist_data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    // comment: 'Array of sections and items with their statuses',
  },

  // overall status and completion details
  status: {
    type: DataTypes.ENUM('in-progress', 'completed'),
    defaultValue: 'in-progress',
  },

  completed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Staff,
      key: 'id',
    },
  },

  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'pre_op_checklists',
  timestamps: true,
//   comment: 'Stores pre-operative checklist information for each surgery/patient',
});

PreOpChecklist.associate = (models) => {
  PreOpChecklist.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
  PreOpChecklist.belongsTo(models.Staff, { foreignKey: 'completed_by', as: 'completedBy' });
  PreOpChecklist.belongsTo(models.TheatrePatients, { foreignKey: 'surgery_schedule_id', as: 'theatre' });
};

module.exports = PreOpChecklist;
 