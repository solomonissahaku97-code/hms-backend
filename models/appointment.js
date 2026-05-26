const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Ensure this path is correct
const Visit = require('./Visit');

const Appointment = sequelize.define('Appointment', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference:{
            model:'staffs',
            key:'id'
        }
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference:{
            model:'institution',
            key:'id'
        }
    },
    appointment_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    appointment_time: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('scheduled', 'completed', 'canceled'),
        allowNull: true,
        defaultValue: 'scheduled'
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference:{
            model:Visit,
            key:'id'
        }
    },
    appointment_type: {
        type: DataTypes.ENUM('consultation', 'checkup', 'emergency', 'follow-up'),
        allowNull: false,
        defaultValue: 'consultation'
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW
    },
    send_reminder:{
        type:DataTypes.BOOLEAN,
        allowNull:true,
        defaultValue:false,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'appointments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Appointment.associate = (models) => {
    Appointment.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'doctor' });
    Appointment.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'patient' });
};

module.exports = Appointment;
