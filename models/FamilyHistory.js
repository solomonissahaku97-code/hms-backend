const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');



const FamilyHistory = sequelize.define('FamilyHistory', {
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
    diabetes: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    hypertension: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    genetic_disorders: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    twin_pregnancy: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    }
}, {
    tableName: 'family_histories',
    timestamps: true
});

FamilyHistory.associate = (models)=>{
    FamilyHistory.belongsTo(models.Patient, {foreignKey: 'patient_id'});
}

module.exports = FamilyHistory;
