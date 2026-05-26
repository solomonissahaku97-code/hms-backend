// models/pregnancyTimeline.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');


const PregnancyTimeline = sequelize.define('PregnancyTimeline', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },

    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'visits',
            key: 'id'
        }
    },

    pregnancy_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'anc_records', // link to ANC record
            key: 'id'
        }
    },

    lmp: { // Last Menstrual Period
        type: DataTypes.DATEONLY,
        allowNull: false
    },

    edd: { // Expected Delivery Date
        type: DataTypes.DATEONLY,
        allowNull: false
    },

    current_week: { // Calculated field
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },

    total_weeks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 40
    },

    progress_percent: { // Calculated field
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },

    weeks: { // Stores week-by-week events & alerts
        type: DataTypes.JSONB, // Use JSONB if using Postgres, otherwise JSON
        allowNull: false,
        defaultValue: []
    }

}, {
    tableName: 'pregnancy_timelines',
    timestamps: true
});

// Associations
PregnancyTimeline.associate = (models) => {
    PregnancyTimeline.belongsTo(models.Patient, {
        foreignKey: 'visit_id',
        as: 'patient'
    });

    PregnancyTimeline.belongsTo(models.ANC, {
        foreignKey: 'pregnancy_id',
        as: 'anc'
    });

    PregnancyTimeline.hasMany(models.PNC, {
        foreignKey: 'pregnancy_timeline_id',
        as: 'pnc_visits'
    });
};

module.exports = PregnancyTimeline;
