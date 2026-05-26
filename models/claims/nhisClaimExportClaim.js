// models/claims/nhisClaimExportClaim.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const NHISClaimExport = require('./nhisClaimExport');
const Claim = require('./claim');
const Institution = require('../institution');

const NHISClaimExportClaim = sequelize.define('NHISClaimExportClaim', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  batch_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  total_claims: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  exported_by: {
    type: DataTypes.UUID, // User ID who generated it
    allowNull: true,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Institution,
      key: 'id',
    },
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Completed', 'Failed'),
    defaultValue: 'Completed',

  }
}, {
  tableName: 'nhis_claim_export_claims',
  timestamps: true,
});

// associations
NHISClaimExportClaim.associate = (models) => {
  NHISClaimExportClaim.belongsTo(models.NHISClaimExport, { foreignKey: 'export_id', as: 'export' });
  NHISClaimExportClaim.belongsTo(models.Claim, { foreignKey: 'claim_id', as: 'claim' });
};

module.exports = NHISClaimExportClaim;
