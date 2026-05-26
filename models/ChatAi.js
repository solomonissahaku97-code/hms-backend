const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const PatientNote = require('./PatientNote');

const ChatAi = sequelize.define('ChatAi', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,

    defaultValue: DataTypes.UUIDV4
  },
  patient_note_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: PatientNote,
      key: 'id',
    },
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Institution,
      key: 'id',
    },
  },
  ai_response: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  confidence_score: {
    type: DataTypes.FLOAT, // Optional: for storing the confidence level of the AI's response
    allowNull: true,
  },
}, {
  tableName: 'chat_ai', // Specify the table name
  timestamps: true, // Enable createdAt and updatedAt
});

ChatAi.associations = (models) => {
  ChatAi.belongsTo(models.PatientNote, { foreignKey: 'patient_note_id', as: 'patient_note' });
  ChatAi.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
};

module.exports = ChatAi;
