const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const LabTestTemplate = require('./LabTestTemplate');
const LabTestResult = require('./LabTestResult');
const Patient = require('../patient');
const Visit = require('../Visit');
const Department = require('../department');
const Staff = require('../staff');
const Institution = require('../institution');

const LabSample = sequelize.define('LabSample', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    sample_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Human-readable accession number, e.g. LAB-20260717-0001'
    },
    barcode: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        comment: 'Machine-readable barcode for label printing'
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Visit,
            key: 'id'
        },
        onDelete: 'CASCADE'
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
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Department,
            key: 'id'
        }
    },
    template_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: LabTestTemplate,
            key: 'id'
        }
    },
    specimen_type: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'blood, urine, stool, swab, etc.'
    },
    specimen_condition: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'acceptable, hemolyzed, lipemic, clotted, insufficient'
    },
    collected_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    collected_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the sample was drawn from the patient'
    },
    received_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    received_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the lab received the sample'
    },
    status: {
        type: DataTypes.ENUM(
            'collected',
            'received',
            'in-progress',
            'completed',
            'rejected',
            'cancelled'
        ),
        allowNull: false,
        defaultValue: 'collected'
    },
    priority: {
        type: DataTypes.ENUM('routine', 'urgent', 'stat'),
        allowNull: false,
        defaultValue: 'routine'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'LabSample',
    tableName: 'lab_samples',
    timestamps: true,
    comment: 'Sample accessioning / collection workflow for lab tests'
});

LabSample.associate = (models) => {
    LabSample.belongsTo(models.LabTestTemplate, {
        foreignKey: 'template_id',
        as: 'template'
    });
    LabSample.belongsTo(models.LabTestResult, {
        foreignKey: 'id',
        as: 'result'
    });
    LabSample.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    LabSample.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });
    LabSample.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department'
    });
    LabSample.belongsTo(models.Staff, {
        foreignKey: 'collected_by',
        as: 'collector'
    });
    LabSample.belongsTo(models.Staff, {
        foreignKey: 'received_by',
        as: 'receiver'
    });
    LabSample.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = LabSample;
