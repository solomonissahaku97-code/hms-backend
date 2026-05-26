const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Test = sequelize.define('Test', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,

    },
    test_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'Test',
    tableName: 'test',
    timestamps: true,
});

module.exports = Test;
