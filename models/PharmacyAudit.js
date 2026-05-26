const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');



const PharmacyAudit = sequelize.define('PharmacyAudit', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    action: {
        type: DataTypes.ENUM(
            'CREATE_PRESCRIPTION',
            'UPDATE_PRESCRIPTION',
            'DISPENSE',
            'REJECT',
            'RETURN',
            'DELETE'
        ),
        allowNull: false
    },
    entityId: {  // ID of the affected prescription/medication
        type: DataTypes.UUID,
        allowNull: false
    },
    entityType: {
        type: DataTypes.ENUM('PRESCRIPTION', 'MEDICATION', 'PATIENT'),
        defaultValue: 'PRESCRIPTION'
    },
    previousState: {  // Store the entire object before changes
        type: DataTypes.JSONB
    },
    newState: {      // Store the entire object after changes
        type: DataTypes.JSONB
    },
    performedBy: {   // Staff ID who made the change
        type: DataTypes.UUID,
        allowNull: false
    },
    ipAddress: {
        type: DataTypes.STRING
    },
    reason: {       // Optional: E.g., "Patient allergy discovered"
        type: DataTypes.TEXT
    }
}, {
    timestamps: true,
    paranoid: false,
    
});


module.exports = PharmacyAudit







