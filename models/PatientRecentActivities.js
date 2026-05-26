const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Visit = require('./Visit');
const Staff = require('./staff');
const Department = require('./department');


const PatientRecentActivities = sequelize.define('patient_recent_activities', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
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

    department_id: {
        type: DataTypes.UUID,
        reference: {
            model: Department,
            key: 'id'
        }
    },
    activity: {
        type: DataTypes.JSON,
        allowNull: false
    }


}, {
    tableName: 'patient_recent_activities', // Optional: specify the table name if different from the model name
    timestamps: true, // Automatically manage createdAt and updatedAt fields
    paranoid: true, // Enable soft deletion\
    underscored: true, // Use snake_case for column names,

})



module.exports = PatientRecentActivities;
