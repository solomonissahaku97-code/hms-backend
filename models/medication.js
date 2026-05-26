const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Medication = sequelize.define('Medication', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    dosage: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    sideEffects: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'Medication',
    tableName: 'medications',
    timestamps: true
});

module.exports = Medication;
