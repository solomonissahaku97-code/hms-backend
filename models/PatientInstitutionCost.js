const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');


const PatientInstitutionCost = sequelize.define('PatientInstitutionCost', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    total_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    }
})

PatientInstitutionCost.associations = (models) => {
    PatientInstitutionCost.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'total_patient_cost' })
}


module.exports = PatientInstitutionCost