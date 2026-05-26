const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');


const systemDiagnosis = sequelize.define('system_diagnosis', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        
    },
    icd_10_code: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true,
        }
    },
    diagnosis_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true,
        }
    },
    gender: {
        type: DataTypes.STRING,
        allowNull: true,
        
    },



    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
        validate: {
            isDate: true,
        }
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
        validate: {
            isDate: true,
        }
    }
}, {
    tableName: 'system_diagnosis',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,

});



// Associations
systemDiagnosis.associate = (models) => {
    systemDiagnosis.hasMany(models.Diagnosis, {
        foreignKey: 'system_diagnosis_id',
        as: 'diagnoses'
    });
   
    systemDiagnosis.hasMany(models.Visit, {
        foreignKey: 'system_diagnosis_id',
        as: 'visits'
    });
};






// export it
module.exports = systemDiagnosis;

