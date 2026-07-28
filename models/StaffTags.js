const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Staff = require('./staff');

const StaffTags = sequelize.define('StaffTags', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    note_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
}, {
    tableName: 'staff_tags',
    timestamps: false,
});

module.exports = StaffTags;
