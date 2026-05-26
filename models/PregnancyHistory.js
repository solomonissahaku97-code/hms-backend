const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');


const PregnancyHistory = sequelize.define('PregnancyHistory', {
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
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    nausea_vomiting: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    dizziness: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    swelling: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    vaginal_bleeding: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    fetal_movements: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    prenatal_vitamins: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    }
}, {
    tableName: 'pregnancy_histories',
    timestamps: true
});

module.exports = PregnancyHistory;
