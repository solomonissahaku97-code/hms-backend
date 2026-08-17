const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const LabInvestigation = require('./claims/LabInvestigations');

const InstitutionLabTariff = sequelize.define('institutionLabTariff', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'institutions',
            key: 'id'
        }
    },
    lab_investigation_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'lab_investigations',
            key: 'id'
        }
    },
    tariff_ghc: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    market_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'institution_lab_tariffs',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['institution_id', 'lab_investigation_id']
        }
    ]
});

InstitutionLabTariff.associate = (models) => {
    InstitutionLabTariff.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
    InstitutionLabTariff.belongsTo(LabInvestigation, {
        foreignKey: 'lab_investigation_id',
        as: 'labInvestigation'
    });
};

module.exports = InstitutionLabTariff;
