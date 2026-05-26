// models/theatre/EducationMaterials.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
// const Staff = require('../users/staff');
// const Admin = require('../users/admin');

const EducationMaterials = sequelize.define('EducationMaterials', {
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
      model: 'theatre_patients',
      key: 'id',
    },
  },

  // JSON-based material structure
  materials_data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Contains structured education materials with viewed status per section',
  },

  status: {
    type: DataTypes.ENUM('not-started', 'in-progress', 'completed'),
    defaultValue: 'not-started',
  },

  viewed_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  total_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  completed_by_staff: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'staffs',
      key: 'id',
    },
  },

  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'education_materials',
  timestamps: true,
});

module.exports = EducationMaterials;
