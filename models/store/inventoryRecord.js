const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const InventoryRecord = sequelize.define('InventoryRecord', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    item_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    item_batch_id: {  
        type: DataTypes.UUID,
        allowNull: true
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    movement_type: { 
        type: DataTypes.ENUM('issued', 'restocked', 'transferred', 'adjusted'),
        allowNull: false
    },
    reference_type: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    reference_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    issued_by: {  
        type: DataTypes.UUID,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    sequelize, 
    modelName: 'InventoryRecord',
    tableName: 'inventory_records',
    timestamps: true,
});

module.exports = InventoryRecord;
