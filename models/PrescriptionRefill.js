const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Department = require('./department');
const Visit = require('./Visit');


const RefillRequest = sequelize.define('RefillRequest', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    prescription_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'prescriptions',
            key: 'id'
        }
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Department,
            key: 'id'
        }
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Visit,
            key: 'id'
        }
    },
    requested_by: { // Could be patient or staff
        type: DataTypes.UUID,
        allowNull: false,
          references: {
            model: 'staffs',
            key: 'id'
        }
    },
    requester_type: {
        type: DataTypes.ENUM('patient', 'staff'),
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    reason: {
        type: DataTypes.TEXT
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'dispensed'),
        defaultValue: 'pending'
    },
    processed_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        }
    }
}, {
    sequelize,
    tableName: 'prescription_refill_requests',
    timestamps: true,
    paranoid: true
});






module.exports = RefillRequest