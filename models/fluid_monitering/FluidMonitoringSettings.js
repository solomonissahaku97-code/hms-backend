const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Visit = require('../Visit');
const Institution = require('../institution');

const FluidMonitoringSettings = sequelize.define('FluidMonitoringSettings', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Visit,
            key: 'id'
        }
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference: {
            model: Institution,
            key: 'id'
        }
    },
    target_daily_intake: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 2000
    },
    target_daily_output: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 1500
    },
    alert_threshold_positive: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 500
    },
    alert_threshold_negative: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: -500
    },
    critical_threshold_positive: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 1000
    },
    critical_threshold_negative: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: -1000
    },
    measurement_unit: {
        type: DataTypes.ENUM('ml', 'l', 'oz'),
        defaultValue: 'ml'
    },
    monitoring_frequency: {
        type: DataTypes.ENUM('continuous', 'hourly', '2hourly', '4hourly', '8hourly', '12hourly', 'daily'),
        defaultValue: '4hourly'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'fluid_monitoring_settings',
    timestamps: true,
    underscored: true,
    indexes: [

        {
            fields: ['institution_id']
        }
    ]
});

// Associations
FluidMonitoringSettings.associate = (models)=>{
    FluidMonitoringSettings.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'patient' });

}
module.exports = FluidMonitoringSettings;