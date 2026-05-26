const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Department = require('./department');
const Institution = require('./institution');
const Visit = require('./Visit');

const VitalSignsRecord = sequelize.define('VitalSignsRecord', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    visit_id: {  // Changed from patient_id to visit_id
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Visit, // Reference the visits table
            key: 'id'
        }
    },
    oxygen: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    SpO2: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    temperature: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    systole: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    diastole: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    heart_rate: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    pulse: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Department,
            key: 'id'
        }
    },
    weight: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    height: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    rbs: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    fbs: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    ppbs: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    pain: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM("Normal", "Abnormal", "Pending Retake"),
        defaultValue: "Normal",
    },
    type: {
        type: DataTypes.ENUM("Pre-Op", "Post-Op", "Routine Checkup"),
        defaultValue: "Routine Checkup",
    },
    abnormal_reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    sequelize,
    modelName: 'VitalSignsRecord',
    tableName: 'vital_signs_records',
    timestamps: true,
});

// VitalSignsRecord.beforeCreate((record, options) => {
//     if (!record.institution_id) {
//         throw new Error('Institution ID is required');
//     }
// });

VitalSignsRecord.associate = (models) => {
    VitalSignsRecord.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });
    VitalSignsRecord.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department'
    });
    VitalSignsRecord.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });

};
 
module.exports = VitalSignsRecord;