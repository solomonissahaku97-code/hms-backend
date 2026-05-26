const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Staff = require('./staff');
const Visit = require('./Visit');

const PatientDiagnosis = sequelize.define('PatientDiagnosis', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Visit,
            key: 'id'
        }
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    diagnosis_ids: {
        type: DataTypes.JSON,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('diagnosis_ids');
            return rawValue ? JSON.parse(rawValue) : [];
        },
        set(value) {
            this.setDataValue('diagnosis_ids', JSON.stringify(value));
        }
    },
    patient_complaint: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            notEmpty: true // Ensure the field is not empty
        }
    },

    doctors_note: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'PatientDiagnosis',
    timestamps: true,
    tableName: 'patient_diagnosis'
});

PatientDiagnosis.associate = (models) => {
    PatientDiagnosis.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });
    PatientDiagnosis.belongsTo(models.Staff, {
        foreignKey: 'staff_id',
        as: 'doctor'
    });

};



PatientDiagnosis.associate = (models) => {
    PatientDiagnosis.belongsTo(models.Staff, {
        foreignKey: 'staff_id',
        as: 'doctor'
    });
    PatientDiagnosis.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });
  

};

module.exports = PatientDiagnosis;
