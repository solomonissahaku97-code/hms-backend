const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const LabTestTemplate = require('./LabTestTemplate');
const Department = require('../department');



const LabTestResult = sequelize.define('LabTestResult', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'visits',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    department_id:{
        type:DataTypes.UUID,
        allowNull:true,
        reference:{
            model:Department,
            key:'id'
        },

    },
    values: {
        type: DataTypes.JSON,
        allowNull: true
    },
    notes: DataTypes.TEXT,
    status: {
        type: DataTypes.ENUM(
            'pending',
            'completed',
            'verified',
            'rejected'
        ),
        defaultValue: 'pending'
    },
    templateId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: LabTestTemplate,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    verifiedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        },
        onDelete: 'SET NULL'
    }
}, {
    timestamps: true,
    tableName: 'lab_test_results',
    comment: 'Table to store lab test fields'
});
LabTestResult.associate = (models) => {
    LabTestResult.belongsTo(models.LabTestTemplate, {
        foreignKey: 'templateId',
        as: 'template'
    });

    LabTestResult.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });

    LabTestResult.belongsTo(models.Staff, {
        foreignKey: 'createdBy',
        as: 'creator'
    });
    LabTestResult.belongsTo(models.Staff, {
        foreignKey: 'verifiedBy',
        as: 'verifier'
    });
    LabTestResult.belongsTo(models.Department,{
        foreignKey:'department_id',
        as:'department'
    });
    
};

module.exports = LabTestResult;
