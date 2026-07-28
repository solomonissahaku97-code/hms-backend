const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');

const InstitutionCall = sequelize.define('InstitutionCall', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    caller_institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        onDelete: 'CASCADE',
    },
    receiver_institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        onDelete: 'CASCADE',
    },
    caller_admin_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    receiver_admin_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    caller_staff_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    receiver_staff_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    call_type: {
        type: DataTypes.ENUM('audio', 'video'),
        defaultValue: 'video',
    },
    status: {
        type: DataTypes.ENUM('initiated', 'ringing', 'accepted', 'rejected', 'completed', 'missed', 'failed', 'ended'),
        defaultValue: 'initiated',
    },
    room_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    started_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    ended_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    duration_seconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    sequelize,
    tableName: 'institution_calls',
    timestamps: true,
    indexes: [
        { fields: ['caller_institution_id'] },
        { fields: ['receiver_institution_id'] },
        { fields: ['status'] },
        { fields: ['createdAt'] },
        { fields: ['room_name'] },
    ],
});

InstitutionCall.associate = (models) => {
    InstitutionCall.belongsTo(models.Institution, {
        foreignKey: 'caller_institution_id',
        as: 'caller_institution',
    });
    InstitutionCall.belongsTo(models.Institution, {
        foreignKey: 'receiver_institution_id',
        as: 'receiver_institution',
    });
};

module.exports = InstitutionCall;