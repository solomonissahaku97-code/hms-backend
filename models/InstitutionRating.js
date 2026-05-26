const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const InstitutionRating = sequelize.define('InstitutionRating', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,

    defaultValue: DataTypes.UUIDV4
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Institution, // Assuming you have an 'Institutions' table or model
      key: 'id',
    },
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true, // Optional field
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true, // Ensures the email is in a valid format
    },
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5, // Assuming a 1-5 star rating system
    },
  },
  review: {
    type: DataTypes.TEXT,
    allowNull: true, // Optional text review
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'InstitutionRating',
  tableName: 'institution_ratings',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['email', 'institution_id'], // Unique constraint for email and institution_id
    },
  ],
});

module.exports = InstitutionRating;
