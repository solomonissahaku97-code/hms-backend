const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const MedicalHistory = sequelize.define('MedicalHistory', {
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
    chronic_conditions: { // e.g., diabetes, hypertension, asthma
        type: DataTypes.TEXT,
        allowNull: true,
    },
    past_surgeries: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    blood_transfusions: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    allergies: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    medications: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'medical_histories',
    timestamps: true
});

MedicalHistory.associate = (models)=>{
    MedicalHistory.belongsTo(models.Patient,{foreignKey:'patient_id',as:'medical_history'})
}

module.exports = MedicalHistory;
