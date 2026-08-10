const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const GDRGCode = require('./claims/GDRGCode');

const InstitutionProcedurePrice = sequelize.define('institutionProcedurePrice', {
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
    gdrg_code_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'gdrg_codes',
            key: 'id'
        }
    },
    market_price: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    nhia_price: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'institution_procedure_prices',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['institution_id', 'gdrg_code_id']
        }
    ]
});

InstitutionProcedurePrice.associate = (models) => {
    InstitutionProcedurePrice.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
    InstitutionProcedurePrice.belongsTo(models.GDRGCode, {
        foreignKey: 'gdrg_code_id',
        as: 'gdrgCode'
    });
};

module.exports = InstitutionProcedurePrice;
