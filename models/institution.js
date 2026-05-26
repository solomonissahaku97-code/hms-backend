const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Subscription = require('./subscription');
const crypto = require('crypto');

const Institution = sequelize.define('Institution', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    contact: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    established_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    operating_hours: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    logo_url: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    google_map_link: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    country: {
        type: DataTypes.STRING,
        allowNull: false,
    }, 
    subscriptionId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Subscription,
            key: 'id',
        },
    },
    region: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    number_of_employees: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    serial_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        defaultValue: () => Math.floor(10000000 + Math.random() * 90000000).toString(),
    },
    fax: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    
}, {
    sequelize,
    modelName: 'Institution',
    timestamps: true,
    tableName: 'institutions',
});

// Hook to generate a secure referral_code before creating an institution


Institution.associations = (models) => {
    Institution.hasMany(models.Patient, { foreignKey: 'institution_id', as: 'patients' });
    Institution.hasMany(models.Department, { foreignKey: 'institution_id', as: 'departments' });
    Institution.hasMany(models.Staff, { foreignKey: 'institution_id', as: 'staffs' });
    Institution.belongsTo(models.InstitutionSubAccounts,{ foreignKey:'institution_id',as:'institution_account' })
};

module.exports = Institution;