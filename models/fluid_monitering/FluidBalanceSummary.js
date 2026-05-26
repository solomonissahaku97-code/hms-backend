const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Visit = require('../Visit');
const Institution = require('../institution');


const FluidBalanceSummary = sequelize.define('FluidBalanceSummary', {
  id: {
      type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
  },
  visit_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Visit,
      key: 'id'
    }
  },
  
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    reference:{
        model:Institution,
        key:'id'
    }
  },
  summary_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  total_intake: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  total_output: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  net_balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  target_intake: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  target_output: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  oral_intake: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  iv_intake: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  other_intake: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  urine_output: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  stool_output: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  vomit_output: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  other_output: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('balanced', 'positive_balance', 'negative_balance', 'critical'),
    defaultValue: 'balanced'
  },
  alerts: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'fluid_balance_summaries',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['visit_id', 'summary_date'],
      unique: true
    },
    
    {
      fields: ['institution_id']
    }
  ]
});

// Associations
FluidBalanceSummary.associate = (models)=>{
    FluidBalanceSummary.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
}

module.exports = FluidBalanceSummary; 