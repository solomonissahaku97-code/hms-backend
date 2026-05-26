const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const ImmunizationHistory = sequelize.define('ImmunizationHistory', {
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
    tetanus_vaccine: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    rubella: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    hepatitis_b: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    recent_infections: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    hiv_syphilis_tested: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    }
}, {
    tableName: 'immunization_histories',
    timestamps: true
});

ImmunizationHistory.associate = (models)=>{
    ImmunizationHistory.belongsTo(models.Patient,{foreignKey:'patient_id',as:'immunization_history'})
}


module.exports = ImmunizationHistory;
