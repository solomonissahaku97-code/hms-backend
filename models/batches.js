const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Batch = sequelize.define('Batch', {

    institution_id: {
        type: DataTypes.UUID, 
        allowNull: false,
        references: {
            model: 'institutions',
            key: 'id'
        },
        comment: "Institution submitting the batch"
    }
}, {
    tableName: 'batches',
    timestamps: false // Set to true if you want createdAt and updatedAt fields
});


module.exports = Batch;