const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Staff = require('./staff');


const OrScheduling = sequelize.define('OrSchedule', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    scheduled_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    scheduled_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    surgeon_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    anesthesiologist_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('Scheduled', 'Completed', 'Cancelled'),
        defaultValue: 'Scheduled',
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'OrScheduling',
    tableName: 'or_schedules',
    timestamps: true
});
OrScheduling.associate = (models) => {
    OrScheduling.belongsTo(models.Patient, { foreignKey: 'patient_id' });
    OrScheduling.belongsTo(models.Institution, { foreignKey: 'institution_id' });
    OrScheduling.belongsTo(models.Staff, { foreignKey: 'surgeon_id', as: 'surgeon' });
    OrScheduling.belongsTo(models.Staff, { foreignKey: 'anesthesiologist_id', as: 'anesthesiologist' });
};
module.exports = OrScheduling;


