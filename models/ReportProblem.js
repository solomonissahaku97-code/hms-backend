const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Staff = require('./staff'); // Assuming you have a Staff model

const ReportProblem = sequelize.define('ReportProblem', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    screenshot: {
        type: DataTypes.STRING,
        allowNull: true
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false
    }
}, {
    tableName: 'report_problems',
    timestamps: true // Add timestamps for createdAt and updatedAt
});

// Define associations
ReportProblem.belongsTo(Institution, { foreignKey: 'institution_id', as: 'institution' });
ReportProblem.belongsTo(Staff, { foreignKey: 'staff_id', as: 'staff' });

module.exports = ReportProblem;
