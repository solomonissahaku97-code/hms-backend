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
        allowNull: true
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
    short_description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    about: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    mission: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    vision: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    core_values: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    website: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    opening_hours: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
    },
    emergency_contact: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    services_offered: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    facilities_available: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    social_media_links: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
    },
    gallery_images: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
    },
    banner_image_url: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    workflow_mode: {
        type: DataTypes.ENUM('full', 'lab_only', 'opd_only', 'records_lab'),
        allowNull: true,
        defaultValue: 'full'
    }
    
}, {
    sequelize,
    modelName: 'Institution',
    timestamps: true,
    tableName: 'institutions',
    paranoid: true,
});

Institution.associate = (models) => {
    Institution.hasMany(models.Patient, { foreignKey: 'institution_id', as: 'patients' });
    Institution.hasMany(models.Department, { foreignKey: 'institution_id', as: 'departments' });
    Institution.hasMany(models.Staff, { foreignKey: 'institution_id', as: 'staffs' });
    Institution.hasMany(models.institutionSubAccounts, { foreignKey: 'institution_id', as: 'sub_accounts' });
};

module.exports = Institution;