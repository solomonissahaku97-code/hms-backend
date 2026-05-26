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
        references: {
            model: 'PatientNotes', // Table name
            key: 'id',
        },
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff, // Table name
            key: 'id',
        },
    },
}, {
    tableName: 'staff_tags',
    timestamps: false,
});

module.exports = StaffTags;
