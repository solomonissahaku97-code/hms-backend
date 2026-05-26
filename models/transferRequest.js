const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Record = require('./record');

const TransferRequest = sequelize.define('TransferRequest', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    record_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Record,
            key: 'id'
        }
    },
    source_institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    target_institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    status: {
        type: DataTypes.ENUM('pending', 'approve', 'reject'),
        allowNull: false,
        defaultValue: 'pending'
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    requested_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'transfer_requests',
    timestamps: false
});

TransferRequest.associate = (models) => {
    TransferRequest.belongsTo(models.Record, { foreignKey: 'record_id', as: 'records' });
    TransferRequest.belongsTo(models.Institution, { foreignKey: 'source_institution_id', as: 'sourceInstitution' });
    TransferRequest.belongsTo(models.Institution, { foreignKey: 'target_institution_id', as: 'targetInstitution' });
};

module.exports = TransferRequest;
