const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Patient = require('./patient');


const SoftwareChargesTable = sequelize.define('software_charges_table', {

    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },

    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    patient_id: {
        type: DataTypes.UUID
    },

    charge_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },

    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',  // Example status values: pending, completed
    },

}, {

})


module.exports = SoftwareChargesTable