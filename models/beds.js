const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Department = require('./department');
const Institution = require('./institution');
const Visit = require('./Visit');

const Bed = sequelize.define('Bed', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    bed_number: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    department_id: {
        type: DataTypes.UUID,
        onDelete: 'CASCADE',   // 👈 ensures database deletes related beds
    },
    status: {
        type: DataTypes.ENUM('available', 'occupied', 'faulty', 'under_maintenance'),
        defaultValue: 'available',
    },
    institution_id: { 
        type: DataTypes.UUID,
        allowNull: false,
        onDelete: 'CASCADE',
    },
    is_occupied: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'Bed',
    timestamps: true,
    tableName: 'beds'
});

// Associations
Bed.associate = (models) => {
    Bed.belongsTo(models.Department, { 
        foreignKey: 'department_id', 
        as: 'department', 
        onDelete: 'CASCADE'    // 👈 cascade delete
    });
    Bed.belongsTo(models.Institution, { 
        foreignKey: 'institution_id', 
        as: 'institution',
        onDelete: 'CASCADE' 
    });
    Bed.belongsTo(models.Visit, { 
        foreignKey: 'visit_id', 
        as: 'visit'  // 👈 renamed from "bed" for clarity
    });
};

module.exports = Bed;
