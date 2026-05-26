


// models/claims/nhisClaimExport.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Institution = require('../institution');
const Staff = require('../staff');
// const User = require('../users/users'); // adjust to your actual user model
// const Institution = require('../institution');

const NHISClaimExport = sequelize.define('NHISClaimExport', {
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
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Institution,
      key: 'id'
    }
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  total_claims: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_amount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0.00,
  },
  generated_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Staff,
      key: 'id'
    }
  },
  export_status: {
    type: DataTypes.ENUM('Pending', 'Submitted', 'Approved', 'Rejected'),
    defaultValue: 'Pending'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  tableName: 'nhis_claim_exports',
  timestamps: true,
});

// associations
NHISClaimExport.associate = (models) => {
  NHISClaimExport.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
  NHISClaimExport.belongsTo(models.Staff, { foreignKey: 'generated_by', as: 'generator' });
  NHISClaimExport.hasMany(models.NHISClaimExportClaim, { foreignKey: 'export_id', as: 'exported_claims' });
}

module.exports = NHISClaimExport;
