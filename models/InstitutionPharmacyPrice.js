const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Medicine = require('./claims/medication');

const InstitutionPharmacyPrice = sequelize.define('institutionPharmacyPrice', {
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
    medicine_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'medicines',
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
    tableName: 'institution_pharmacy_prices',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['institution_id', 'medicine_id']
        }
    ]
});

InstitutionPharmacyPrice.associate = (models) => {
    InstitutionPharmacyPrice.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
    InstitutionPharmacyPrice.belongsTo(models.Medicine, {
        foreignKey: 'medicine_id',
        as: 'medicine'
    });
};

module.exports = InstitutionPharmacyPrice;
