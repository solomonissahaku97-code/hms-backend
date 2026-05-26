const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');


const InstitutionBusinessDetails = sequelize.define('institutionBusinessDetails', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    business_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    account_number: {
        type: DataTypes.STRING(25),
        allowNull: false,
    },
    primary_contact_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    primary_contact_email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    primary_contact_phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    institution_id: {
        type: DataTypes.UUID,
        references: {
            model: Institution,
            key: 'id'
        }
    }
})



module.exports = InstitutionBusinessDetails