const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const LabInvestigation = sequelize.define('lab_investigation', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    test_description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    g_drg_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    tariff_ghc: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    market_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue:0.0
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'lab_investigations',
    timestamps: true
});


LabInvestigation.associate = (models)=>{
   LabInvestigation.hasMany(models.LabTestTemplate, {
    foreignKey: 'lab_tarrif_id',
    as: 'templates'
  });
}


module.exports = LabInvestigation;