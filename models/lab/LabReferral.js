const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const LabReferral = sequelize.define('LabReferral', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    referral_number: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Human-readable referral number, e.g. REF-20260814-0001'
    },
    referring_institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Institution sending the referral'
    },
    receiving_institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Institution receiving the referral'
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Original visit at referring institution'
    },
    requested_by: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Staff/user who requested the referral'
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Department at referring institution'
    },
    referral_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    status: {
        type: DataTypes.ENUM(
            'pending',
            'sent',
            'accepted',
            'sample_collected',
            'processing',
            'result_ready',
            'result_received',
            'completed',
            'rejected',
            'cancelled'
        ),
        allowNull: false,
        defaultValue: 'pending'
    },
    clinical_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Why the test cannot be performed internally'
    },
    clinical_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Relevant clinical information for the receiving lab'
    },
    expected_result_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    result_received_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'LabReferral',
    tableName: 'lab_referrals',
    timestamps: true,
    indexes: [
        { fields: ['referring_institution_id'] },
        { fields: ['receiving_institution_id'] },
        { fields: ['patient_id'] },
        { fields: ['visit_id'] },
        { fields: ['status'] }
    ]
});

LabReferral.associate = (models) => {
    LabReferral.belongsTo(models.Institution, {
        foreignKey: 'referring_institution_id',
        as: 'referringInstitution'
    });
    LabReferral.belongsTo(models.Institution, {
        foreignKey: 'receiving_institution_id',
        as: 'receivingInstitution'
    });
    LabReferral.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    LabReferral.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });
    LabReferral.belongsTo(models.Staff, {
        foreignKey: 'requested_by',
        as: 'requester'
    });
    LabReferral.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department'
    });
    LabReferral.hasMany(models.LabReferralItem, {
        foreignKey: 'referral_id',
        as: 'items'
    });
    LabReferral.hasMany(models.LabTestResult, {
        foreignKey: 'referral_id',
        as: 'results'
    });
};

module.exports = LabReferral;
