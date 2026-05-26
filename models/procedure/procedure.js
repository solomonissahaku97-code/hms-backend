const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const systemDiagnosis = require('../claims/systemDiagnosis');

const Procedure = sequelize.define('Procedure', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    selected_procedure_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'gdrg_codes', 
            key: 'id'
        }
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'visits',
            key: 'id'
        }
    },
    doctor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    procedure_datetime: {
        type: DataTypes.STRING,  // Changed from STRING to DATE
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'scheduled', 'ongoing', 'completed', 'canceled'),
        defaultValue: 'pending'
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional procedure-specific data',
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'departments',
            key: 'id'
        }
    },
    corresponding_diagnosis_id:{
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: systemDiagnosis,
            key: 'id'
        }
    }
}, {
    tableName: 'procedures',
    timestamps: true
});

// Associations
Procedure.associate = (models) => {
    // Main doctor association
    Procedure.belongsTo(models.Staff, {
        foreignKey: 'doctor_id',
        as: 'primary_doctor'  // Unique alias
    });

    // Assisting staff through junction table
    Procedure.belongsToMany(models.Staff, {
        through: models.ProcedureStaff,
        foreignKey: 'procedure_id',
        otherKey: 'staff_id',
        as: 'assisting_staff'  // Unique alias
    });

    // Other associations
    Procedure.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });

    Procedure.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department'
    });

    Procedure.belongsTo(models.GDRGCode, {
        foreignKey: 'selected_procedure_id',
        as: 'procedure_code'
    });

};

module.exports = Procedure;