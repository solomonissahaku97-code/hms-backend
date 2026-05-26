const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const OrganDonor = sequelize.define('OrganDonor', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Patient,
            key: 'id'
        }
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    // Donor status
    is_donor: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Donor card number
    donor_card_number: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    // Registration date
    registration_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    // Organs to donate
    organs_to_donate: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of organs: kidney, liver, heart, lungs, pancreas, corneas, etc.'
    },
    // Tissue to donate
    tissues_to_donate: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of tissues: corneas, skin, bone, etc.'
    },
    // Any restrictions
    restrictions: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Primary contact for donation
    donor_contact_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    donor_contact_phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    donor_contact_relationship: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    // Secondary contact
    secondary_contact_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    secondary_contact_phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    // Next of kin aware
    next_of_kin_aware: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // Notes
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Updated by
    updated_by: {
        type: DataTypes.UUID,
        allowNull: true
    },
    // Is active
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'organ_donor',
    timestamps: true,
    underscored: true
});

// Associations
OrganDonor.associate = (models) => {
    OrganDonor.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    OrganDonor.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
};

module.exports = OrganDonor;

