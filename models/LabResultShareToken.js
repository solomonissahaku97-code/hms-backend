const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LabResultShareToken = sequelize.define('LabResultShareToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  lab_result_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  token_hash: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true,
  },
  token_prefix: {
    type: DataTypes.STRING(8),
    allowNull: false,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  revoked_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  last_accessed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  access_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sms_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  sms_sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'lab_result_share_tokens',
  timestamps: true,
});

LabResultShareToken.associate = (models) => {
  LabResultShareToken.belongsTo(models.LabTestResult, {
    foreignKey: 'lab_result_id',
    as: 'labResult',
  });
  LabResultShareToken.belongsTo(models.Institution, {
    foreignKey: 'institution_id',
    as: 'institution',
  });
};

module.exports = LabResultShareToken;
