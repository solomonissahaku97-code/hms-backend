const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');


const PaymentGateWay = sequelize.define('PaymentGateWay', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false

    },
    payment_link: {
        type: DataTypes.STRING
    },
    description: {
        type: DataTypes.TEXT,

    }
})



module.exports = PaymentGateWay;

