const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Staff = require('./staff');
const Visit = require('./Visit');

const Discharge = sequelize.define('discharge', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        references: {
            model: Visit,
            key: 'id'
        },
        allowNull: false
    },

    doctor_id: {
        type: DataTypes.UUID,
        references: {
            model: Staff,
            key: 'id'
        },
        allowNull: false
    },
    discharge_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM(
            'routine',
            'ama',
            'transfer',
            'expired'
        ),
        allowNull: false
    },
    // Common fields
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Routine discharge fields
    follow_up_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    instructions: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // AMA discharge fields
    ama_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    risks_acknowledged: {
        type: DataTypes.ARRAY(DataTypes.STRING), // Stores the checkbox values
        allowNull: true
    },
    // Transfer fields
    facility_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    transfer_reason: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Expired fields
    time_of_death: {
        type: DataTypes.DATE,
        allowNull: true
    },
    cause_of_death: {
        type: DataTypes.STRING,
        allowNull: true
    },
    death_certificate_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Status tracking
    status: {
        type: DataTypes.ENUM(
            'pending',
            'completed',
            'cancelled'
        ),
        defaultValue: 'completed'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: true, // We're manually handling created_at/updated_at
    underscored: true, // Use snake_case for column names
    tableName: 'discharges' // Explicit table name
});

// Associations
Discharge.associate = (models) => {
    Discharge.belongsTo(models.Visit, { foreignKey: 'visit_id' });
    Discharge.belongsTo(models.Staff, { foreignKey: 'doctor_id' });
}

module.exports = Discharge;