const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');

// Define Insurance model
const Insurance = sequelize.define('Insurance', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    patient_id: {
        type: DataTypes.UUID,
        references: {
            model: Patient,
            key: 'id'
        }
    },
    insurance_provider: {
        type: DataTypes.ENUM('NHIS', 'PRIVATE'),
        allowNull: true,
    },
    insurance_number: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    insurance_expiry_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    institution_id: {
        type: DataTypes.UUID,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    insured: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
},{
    sequelize,
    modelName: 'Insurance',
    tableName: 'insurances',
    timestamps: true,
    comment: 'Table to store patient insurance details'
});

// associate Insurance with Patient
Insurance.associate = (models) => {
    Insurance.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    Insurance.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

module.exports = Insurance;
