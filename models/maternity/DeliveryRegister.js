// models/deliveryRegister.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');


const DeliveryRegister = sequelize.define('DeliveryRegister', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },

  date_of_delivery: {
    type: DataTypes.DATE,
    allowNull: false
  },

  parity: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  mode_of_delivery: {
    type: DataTypes.ENUM('SVD', 'Assisted', 'Caesarean', 'Other'),
    allowNull: false
  },

  presentation: {
    type: DataTypes.ENUM('Cephalic', 'Breech', 'Transverse', 'Other'),
    allowNull: true
  },

  baby_sex: {
    type: DataTypes.ENUM('Male', 'Female', 'Unknown'),
    allowNull: false
  },

  birth_weight: {
    type: DataTypes.FLOAT, // kg
    allowNull: true
  },

  apgar_score: {
    type: DataTypes.JSON, 
    allowNull: true
    // Example: { "1min": 7, "5min": 9 }
  },

  outcome: {
    type: DataTypes.ENUM('Alive', 'Stillbirth', 'Neonatal Death'),
    allowNull: false
  },

  complications: {
    type: DataTypes.ENUM(
      'PPH', 
      'Eclampsia', 
      'Obstructed Labour', 
      'Sepsis', 
      'Other'
    ),
    allowNull: true,
    defaultValue:'PPH'
  },

  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  }

}, {
  tableName: 'delivery_register',
  timestamps: true
});

// Associations
DeliveryRegister.associate = (models) => {
  DeliveryRegister.belongsTo(models.Visit, {
    foreignKey: 'visit_id',
    as: 'visit'
  });

  DeliveryRegister.belongsTo(models.Institution, {
    foreignKey: 'institution_id',
    as: 'institution'
  });
};

module.exports = DeliveryRegister;
