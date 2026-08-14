const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SyncOperation = sequelize.define('SyncOperation', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    operation_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique idempotency key for the operation'
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Institution that originated the operation'
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User who performed the operation'
    },
    entity: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Entity name e.g. patient, visit, appointment'
    },
    operation: {
        type: DataTypes.ENUM('CREATE', 'UPDATE', 'DELETE'),
        allowNull: false,
        comment: 'Type of operation'
    },
    record_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Local/client record ID'
    },
    server_record_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Server-assigned record ID after sync'
    },
    payload: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Operation payload/data'
    },
    status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'conflict'),
        allowNull: false,
        defaultValue: 'pending'
    },
    attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    last_error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'SyncOperation',
    tableName: 'sync_operations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['operation_id']
        },
        {
            fields: ['institution_id', 'status']
        },
        {
            fields: ['entity', 'record_id']
        }
    ]
});

module.exports = SyncOperation;
