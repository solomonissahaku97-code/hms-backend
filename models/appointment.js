const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
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
        allowNull: false
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
    send_reminder:{
        type:DataTypes.BOOLEAN,
        allowNull:true,
        defaultValue:false,
    },
    token: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Shareable token for public appointment viewing'
    },
    sms_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    sms_sent_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    viewed_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    viewed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW
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
    Appointment.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
};

module.exports = Appointment;
