const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const LabTestTemplate = require('./LabTestTemplate');
const Department = require('../department');

const LabTestResult = sequelize.define('LabTestResult', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    sample_number: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Accession number from LabSample'
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: true,
        onDelete: 'CASCADE'
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    department_id:{
        type: DataTypes.UUID,
        allowNull: true
    },
    templateId: {
        type: DataTypes.UUID,
        allowNull: false,
        onDelete: 'CASCADE'
    },
    values: {
        type: DataTypes.JSON,
        allowNull: true
    },
    attachments: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of uploaded result file objects: { name, url, type }'
    },
    abnormal_flags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of abnormal field flags computed against LabRanges'
    },
    notes: DataTypes.TEXT,
    request_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comment from the doctor/requester when ordering the test'
    },
    technician_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Comment from the lab technician when entering results'
    },
    specimen_type: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Actual specimen collected, e.g. blood, urine'
    },
    specimen_condition: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'hemolyzed / lipemic / clotted / acceptable'
    },
    status: {
        type: DataTypes.ENUM(
            'pending',
            'in-progress',
            'completed',
            'verified',
            'released',
            'rejected',
            'cancelled'
        ),
        allowNull: false,
        defaultValue: 'pending'
    },
    rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason when status is rejected'
    },
    rerun_of_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'If this result is a rerun, points to the original result id'
    },
    createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        onDelete: 'SET NULL'
    },
    verifiedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        onDelete: 'SET NULL'
    },
    releasedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        onDelete: 'SET NULL'
    },
    releasedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    tat_started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When sample was received / test started'
    },
    tat_completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When result was verified/released'
    },
    tat_minutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Turnaround time in minutes'
    }
}, {
    timestamps: true,
    tableName: 'lab_test_results',
    comment: 'Table to store lab test results'
});

LabTestResult.associate = (models) => {
    LabTestResult.belongsTo(models.LabTestTemplate, {
        foreignKey: 'templateId',
        as: 'template'
    });

    LabTestResult.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });

    LabTestResult.belongsTo(models.Staff, {
        foreignKey: 'createdBy',
        as: 'creator'
    });

    LabTestResult.belongsTo(models.Staff, {
        foreignKey: 'verifiedBy',
        as: 'verifier'
    });

    LabTestResult.belongsTo(models.Staff, {
        foreignKey: 'releasedBy',
        as: 'releaser'
    });

    LabTestResult.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department'
    });

    LabTestResult.belongsTo(models.LabTestResult, {
        foreignKey: 'rerun_of_id',
        as: 'rerunOf'
    });
};

module.exports = LabTestResult;
