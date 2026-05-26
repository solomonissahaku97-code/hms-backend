const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const LabTestTemplate = require('./LabTestTemplate');



const LabTestField = sequelize.define('LabTestField', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    label: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fieldType: {
        type: DataTypes.ENUM(
            'text',
            'number',
            'select',
            'checkbox', 
            'radio',
            'date',
            'textarea'
        ),
        allowNull: false
    },
    options: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    required: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    templateId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: LabTestTemplate,
            key: 'id'
        },
        onDelete: 'CASCADE'
    }

}, {
    sequelize,
    modelName: 'LabTestField',
    tableName: 'lab_test_fields',
    timestamps: true,
    comment: 'Table to store fields for lab test templates'
});

LabTestField.associate = (models) => {
    LabTestField.belongsTo(models.LabTestTemplate, {
        foreignKey: 'template_id',
        as: 'template'
    });  
    LabTestField.belongsTo(models.LabTestTemplate, {
        foreignKey: 'templateId',
        as: 'fields'
    });
};
module.exports = LabTestField;



