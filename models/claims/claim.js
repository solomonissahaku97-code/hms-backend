const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Visit = require('../Visit');
const ClaimItem = require('./claimItem');


const Claim = sequelize.define('Claim', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    claim_status: {
        type: DataTypes.ENUM('Pending', 'Submitted', 'Approved', 'Rejected', 'Resubmitted', 'Draft'),
        defaultValue: 'Pending'
    },
    submission_date: {
        type: DataTypes.DATE
    },
    total_amount: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    total_nhia_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0,
        comment: 'Sum of NHIA-covered amounts across all claim items'
    },
    total_patient_amount: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0,
        comment: 'Sum of patient co-payments across all claim items'
    },
    claim_reference_number: {
        type: DataTypes.STRING,
        allowNull: false,
        // unique: true,
        // comment: 'Unique reference number for the claim'
    },
    // Add to your Claim model
    batch_id: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: DataTypes.UUIDV4
    }

}, {
    timestamps: true,
    tableName: 'claims',
    comment: 'Table to store claims information',
});


Claim.associate = (models) => {
    Claim.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });

    Claim.hasMany(models.ClaimItem, {
        foreignKey: 'claim_id',
        as: 'items'
    });
};




module.exports = Claim;
