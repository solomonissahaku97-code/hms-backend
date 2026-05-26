// models/Partograph.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Partograph = sequelize.define('Partograph', {
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
    // Time of recording
    record_time: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },

    // Cervical dilatation (cm, plotted on graph)
    cervical_dilatation: {
        type: DataTypes.FLOAT,
        allowNull: true
    },

    // Descent of head (station)
    descent_of_head: {
        type: DataTypes.FLOAT,
        allowNull: true
    },

    // Fetal heart rate
    fetal_heart_rate: {
        type: DataTypes.INTEGER,
        allowNull: true
    },

    // Uterine contractions (per 10 minutes)
    contractions_frequency: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    contractions_strength: {
        type: DataTypes.ENUM('Mild', 'Moderate', 'Strong'),
        allowNull: true
    },

    // Maternal vitals
    blood_pressure: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pulse: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    temperature: {
        type: DataTypes.FLOAT,
        allowNull: true
    },

    // Urine analysis
    urine_protein: {
        type: DataTypes.STRING,
        allowNull: true
    },
    urine_acetone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    urine_volume: {
        type: DataTypes.FLOAT,
        allowNull: true
    },

    // Drugs & IV fluids
    drugs_administered: {
        type: DataTypes.TEXT, // could be JSON if structured
        allowNull: true
    },
    iv_fluids: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    labour_start_time: {
        type: DataTypes.DATE,
        allowNull: true
    },

    remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    alert: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    action: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    risk_alerts: {
        type: DataTypes.JSON,  // array of risk flags
        allowNull: true
    }

}, {
    tableName: 'partographs',
    timestamps: true
});

// Associations
Partograph.associate = (models) => {
    Partograph.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
};

module.exports = Partograph;
