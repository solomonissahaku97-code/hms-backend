const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const InstitutionContactInfo = sequelize.define('InstitutionContactInfo', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution, // Make sure this matches your Institution model's table name
            key: 'id'
        },
        onDelete: 'CASCADE' // Delete contact info if institution is deleted
    },
    phone_number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    facebook_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isUrl: true
        }
    },
    twitter_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isUrl: true
        }
    },
    instagram_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isUrl: true
        }
    },
    website_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isUrl: true
        }
    }
}, {
    tableName: 'institution_contact_info',
    timestamps: true
});

module.exports = InstitutionContactInfo;
