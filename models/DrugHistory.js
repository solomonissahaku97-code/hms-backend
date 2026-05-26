const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');



const DrugHistory  = sequelize.define('drugHistory', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,   
        references: {
            model: 'visits', // Assuming the patients table is named 'visits'
            key: 'id'
        }
    },
    drug_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    dosage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    frequency: {
        type: DataTypes.STRING,
        allowNull: true
    },
    route: {
        type: DataTypes.STRING,
        allowNull: true
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'drug_history', // Optional: specify the table name if different from the model name
    timestamps: true, // Automatically manage createdAt and updatedAt fields
    paranoid: true, // Enable soft deletion
    underscored: true, // Use snake_case for column names
    indexes: [
        {
            fields: ['visit_id']
        }
    ]
});





module.exports = DrugHistory;