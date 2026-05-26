const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Staff = require('./staff'); 
const Department = require('./department');
const Institution = require('./institution');
const Visit = require('./Visit');

const Prescription = sequelize.define('Prescription', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4
    },
    medication_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'medicines',
            key: 'id'
        }
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Department,
            key: 'id'
        }
    },
    is_dispensed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    pharmacist_note: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Visit,
            key: 'id'
        }
    },
    dosage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    frequency: {
        type: DataTypes.STRING,
        allowNull: true,

    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 1
        },
        defaultValue: 1
    },
    notes: {
        type: DataTypes.STRING,
        allowNull: true
    },
    prescribing_staff_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    doctor_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    refill: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 1
        }
    },
    status: {
        type: DataTypes.ENUM('pending', 'dispensed', 'canceled'),
        defaultValue: 'pending'
    },
    is_emergency: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    route: {
        type: DataTypes.STRING,
        allowNull: true
    },
    doseUnitType: {
        type: DataTypes.STRING,
        allowNull: true
    }





}, {
    sequelize,
    modelName: 'Prescription',
    timestamps: true,
    tableName: 'prescriptions',
    underscored: true,
    paranoid: true, // Enables soft deletes
    hooks: {
        beforeCreate: (prescription, options) => {
            // // calculate the start day and the end day base on the duration figure provided.
            // // for example, if duration is 5, then start_date will be today and end_date will be today + 5 days
            const today = new Date();
            prescription.start_date = today;
            // prescription.end_date = new Date(today.setDate(today.getDate() + prescription.duration));

            // // what else can you do
            // // e.g., validate dosage, frequency, etc.
            // if (!prescription.dosage || !prescription.frequency) {
            //     throw new Error('Dosage and frequency are required');
            // }

            // prescription.quantity = prescription.dosage * prescription.frequency * prescription.duration;
        },
        beforeUpdate: (prescription, options) => {
            // Additional logic before updating a prescription can be added here
        }
    }
},
    {
        indexes: [
            {
                fields: ['medication_id', 'department_id', 'visit_id', 'prescribing_staff_id', 'institution_id']
            }
        ]
    }


);

// association
Prescription.associate = (models) => {
    Prescription.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
    Prescription.belongsTo(models.Staff, { foreignKey: 'prescribing_staff_id', as: 'prescribingStaff' });
    Prescription.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    Prescription.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    Prescription.belongsTo(models.Staff, { foreignKey: 'doctor_id', as: 'doctor' });
    Prescription.belongsTo(models.Medicine, { foreignKey: 'medication_id', as: 'medicine' })
    Prescription.hasMany(models.RefillRequest, {
        foreignKey: 'prescription_id',
        as: 'refillRequests'
    });
    // In Prescription model's associate method
    Prescription.hasMany(models.ClinicalIntervention, {
        foreignKey: 'prescription_id',
        as: 'clinicalInterventions'
    });
    Prescription.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });


};


module.exports = Prescription;
