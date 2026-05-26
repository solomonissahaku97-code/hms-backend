const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');


const PastMedicalHistory  = sequelize.define('pastMedicalHistory', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'visits',
            key: 'id'
        }
    },
    condition: {
        type: DataTypes.STRING,
        allowNull: false
    },
    diagnosis_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'controlled', 'resolved'),
        allowNull: false,
        defaultValue: 'active'
    },
    treatment: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'past_medical_history',
    timestamps: true,
    paranoid: true,
    underscored: true,
    indexes: [
        {
            fields: ['visit_id']
        }
    ]
}); 



module.exports = PastMedicalHistory
