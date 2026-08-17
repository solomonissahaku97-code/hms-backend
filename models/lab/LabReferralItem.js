const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const LabReferralItem = sequelize.define('LabReferralItem', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    referral_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Parent referral'
    },
    template_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Requested lab test template'
    },
    request_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Specific notes for this test'
    },
    result_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Linked LabTestResult id once completed'
    }
}, {
    sequelize,
    modelName: 'LabReferralItem',
    tableName: 'lab_referral_items',
    timestamps: true
});

LabReferralItem.associate = (models) => {
    LabReferralItem.belongsTo(models.LabReferral, {
        foreignKey: 'referral_id',
        as: 'referral'
    });
    LabReferralItem.belongsTo(models.LabTestTemplate, {
        foreignKey: 'template_id',
        as: 'template'
    });
    LabReferralItem.belongsTo(models.LabTestResult, {
        foreignKey: 'result_id',
        as: 'result'
    });
};

module.exports = LabReferralItem;
