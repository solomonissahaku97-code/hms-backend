const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const PatientBloodGroup = sequelize.define('patient_blood_group', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    bloodGroup: {
        type: DataTypes.ENUM(
            'A+',
            'A-',
            'B+',
            'B-',
            'AB+',
            'AB-',
            'O+',
            'O-'
        ),
        allowNull: true,
    },
    patient_id: {
        type: DataTypes.UUID,
        references: {
            model: Patient,
            key: 'id'
        }
    },
    institution_id: {
        type: DataTypes.UUID,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    allergies: {
        type: DataTypes.JSON,
        allowNull: true
    },

});


PatientBloodGroup.associations = (models) => {
    PatientBloodGroup.belongsTo(models.Patient, { foreignKey: 'blood_group_id', as: 'blood_group' })
}




module.exports = PatientBloodGroup;
