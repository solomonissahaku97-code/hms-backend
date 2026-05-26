const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Institution,
      key: 'id'
    }
  },
  role_manager: {
    type: DataTypes.STRING(10),
    defaultValue: 'admin',
    allowNull: false,
    validate: {
      is: /^admin$/ // Only allows the string "admin"
    }
  },
  verification_token: {
    type: DataTypes.STRING(6),
    allowNull: true
  },
  token_expiration: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Admin',
  tableName: 'admins',
  timestamps: true
});

Admin.associate = (models) => {
  Admin.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
};

module.exports = Admin;
