const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const InstitutionSubAccounts = sequelize.define('institutionSubAccounts', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
    },
    institution_id: {
        type: DataTypes.UUID,
        references: {
            model: Institution,
            key: 'id',
        }
    },

    subaccount_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Ensure subaccount_code is unique
    },
    business_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    settlement_bank: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    account_number: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    percentage_charge: {
        type: DataTypes.FLOAT,
        allowNull: true, // Optional field
    },
    primary_contact_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    primary_contact_email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    primary_contact_phone: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true, // Optional field
    },
    paystack_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    domain: {
        type: DataTypes.STRING,
        allowNull: true, // Optional field
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true, // Optional field
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    timestamps: true, // Automatically manage createdAt and updatedAt
    tableName: 'institutionSubAccounts', // Explicitly set the table name
});

InstitutionSubAccounts.associate = (models)=>{
    InstitutionSubAccounts.belongsTo(models.Institution,{foreignKey:'institution_id',as:'payment_accounts'})
}

module.exports = InstitutionSubAccounts;
