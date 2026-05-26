const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NHIATariffs = sequelize.define('NHIATariffs', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    code: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    category: {
        type: DataTypes.ENUM('Procedure', 'Medicine', 'ICD', 'Investigation'),
        allowNull: true,
    },
    tariff: {
        type: DataTypes.FLOAT,
        allowNull: true,
        // comment: "NHIA-approved cost for the service or medicine"
    },
    level: {
        type: DataTypes.ENUM('Primary', 'Secondary', 'Tertiary'),
        allowNull: true,
        // comment: "Health facility level (e.g., primary, secondary, tertiary)"
    }
}, {
    tableName: 'nhiaTariffs',
    timestamps: false
});

module.exports = NHIATariffs;
