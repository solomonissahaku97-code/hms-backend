// models/theatre/EducationMaterials.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');



const PatientAllergies = sequelize.define('PatientAllergies', {
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
//   alergies should be in list
    allergies: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
    comment: 'List of patient allergies',
  },
  
  severity: {
    type: DataTypes.ENUM('mild', 'moderate', 'severe'),
    allowNull: true,
  },
    notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

});

// associations
PatientAllergies.associate = (models) => {
  PatientAllergies.belongsTo(models.Visit, {
    foreignKey: 'visit_id',
    as: 'visit',
  });
};

module.exports = PatientAllergies;
