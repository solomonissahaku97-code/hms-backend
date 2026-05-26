const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const NHIAMapping = sequelize.define('NHIAMapping', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // NHIA Information (STANDARDIZED)
  nhiaCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  nhiaDescription: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  
  // Mapping to Your Existing Models
  entityType: {
    type: DataTypes.ENUM('medicine', 'procedure', 'lab_test', 'diagnosis'),
    allowNull: false,
  },
  
  // References to your existing models
  medicineId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'medicines',
      key: 'id'
    }
  },
  procedureId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'gdrg_codes',
      key: 'id'
    }
  },
  labTestId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'lab_investigations',
      key: 'id'
    }
  },
  diagnosisId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'system_diagnosis',
      key: 'id'
    }
  },
  
  // Your Existing Codes (for quick reference)
  internalCode: {
    type: DataTypes.STRING(50),
  },
  
  // Pricing Information
  nhiaPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  patientShare: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  nhiaCoverage: {
    type: DataTypes.DECIMAL(12, 2),
  },
  
  // Validation Rules
  requiresPreAuth: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  maxQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  
  // Validity Period
  effectiveDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  expirationDate: {
    type: DataTypes.DATE,
  },
  
  // Status
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  // Audit
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastUsed: {
    type: DataTypes.DATE
  }

}, {
  tableName: 'nhia_mappings',
  timestamps: true,
  indexes: [
 
    {
      fields: ['medicineId']
    },
    {
      fields: ['procedureId']
    },
    {
      fields: ['labTestId']
    },
    {
      fields: ['diagnosisId']
    },
    {
      fields: ['isActive']
    }
  ]
});

// Associations
NHIAMapping.associate = (models) => {
  NHIAMapping.belongsTo(models.Medicine, {
    foreignKey: 'medicineId',
    as: 'medicine'
  });
  
  NHIAMapping.belongsTo(models.GDRGCode, {
    foreignKey: 'procedureId',
    as: 'procedure'
  });
  
  NHIAMapping.belongsTo(models.lab_investigation, {
    foreignKey: 'labTestId',
    as: 'labTest'
  });
  
  NHIAMapping.belongsTo(models.system_diagnosis, {
    foreignKey: 'diagnosisId',
    as: 'diagnosis'
  });
};

module.exports = NHIAMapping;