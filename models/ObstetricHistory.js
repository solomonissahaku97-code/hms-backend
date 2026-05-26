const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

const ObstetricHistory = sequelize.define('ObstetricHistory', {
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
    gravida: { // Number of times pregnant
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    parity: { // Number of births
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    miscarriages: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    stillbirths: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    c_section: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    complications: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'obstetric_histories',
    timestamps: true
});

ObstetricHistory.associate = (models)=>{
    ObstetricHistory.belongsTo(models.Patient,{foreignKey:'patient_id',as:'obstetric_history'})
}

module.exports = ObstetricHistory;
