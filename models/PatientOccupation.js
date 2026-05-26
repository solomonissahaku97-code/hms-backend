const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');


const PatientOccupationHistory  = sequelize.define('patientOccupationHistory', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'visits', // Assuming the patients table is named 'visits'
            key: 'id'
        }
    },
    occupation: {
        type: DataTypes.STRING,
        allowNull: false
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'patient_occupation_history', // Optional: specify the table name if different from the model name
    timestamps: true, // Automatically manage createdAt and updatedAt fields
    paranoid: true, // Enable soft deletion
    underscored: true, // Use snake_case for column names
    indexes: [
        {
            fields: ['visit_id']
        }
    ]
});


module.exports = PatientOccupationHistory;





