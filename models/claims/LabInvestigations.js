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
        defaultValue: 0.0
    },
    specimen_types: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Allowed specimen types, e.g. ["blood", "urine", "stool"]'
    },
    turnaround_time_hours: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 24,
        comment: 'Expected turnaround time in hours'
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true
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
  LabInvestigation.belongsTo(models.Department, {
    foreignKey: 'department_id',
    as: 'department'
  });
};

module.exports = LabInvestigation;
