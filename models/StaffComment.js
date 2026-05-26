const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StaffComment = sequelize.define('StaffComment', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  patient_note_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  staff_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  tagged_staff_ids: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    allowNull: true,
    defaultValue: [],
  },
}, {
  tableName: 'staff_comments',
  timestamps: true,
});

// Define associations - only run if models are available
StaffComment.associate = function(models) {
  if (!models) return;
  
  // Check if Staff model is available
  if (models.Staff) {
    StaffComment.belongsTo(models.Staff, {
      foreignKey: 'staff_id',
      as: 'author',
      onDelete: 'CASCADE',
    });
  }
  
  // Check if PatientNote model is available
  if (models.PatientNote) {
    StaffComment.belongsTo(models.PatientNote, {
      foreignKey: 'patient_note_id',
      as: 'note',
      onDelete: 'CASCADE',
    });
  }
  
  // Check if Staff model is available for tagging
  if (models.Staff) {
    StaffComment.belongsToMany(models.Staff, {
      through: 'StaffCommentTags',
      foreignKey: 'staff_comment_id',
      as: 'taggedStaff',
    });
  }
};

module.exports = StaffComment;
