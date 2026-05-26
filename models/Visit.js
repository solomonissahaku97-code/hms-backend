const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');
const { type } = require('../validators/validateInstitution');
const Department = require('./department');

const Visit = sequelize.define('Visit', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Patient,
            key: 'id'
        }
    },
    attendance_number: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true, // Ensure attendance number is unique
        validate: {
            is: /^[A-Z0-9]+$/i // Allow alphanumeric characters only
        }


    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Institution, // Ensure this matches your Institution model's table name
            key: 'id'
        },
        onDelete: 'CASCADE' // Delete visit if institution is deleted
    },

    department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Department,
            key: 'id'
        }
    },
    on_admission: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Indicates if the visit is for an admission'
    },

    bed_number: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Bed number for the visit, applicable if on_admission is true'
    },
    admission_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date of admission, applicable if on_admission is true'
    },
    discharge_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date of discharge, applicable if on_admission is true'
    },

    attendance_type: {
        type: DataTypes.ENUM('New', 'Follow-up', 'Emergency', 'Referral', 'Transfer'),
        allowNull: true,
        defaultValue: 'New',
    },

    visit_type: {
        type: DataTypes.ENUM('General OPD', 'Maternity'),
        allowNull: false,
        defaultValue: 'General OPD'
    },
    discharge_type: {
        type: DataTypes.ENUM(
            'routine',
            'ama',
            'transfer',
            'expired'
        ),
        allowNull: true,
        // comment: 'Type of discharge, applicable if on_admission is true'
    },
    visit_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    status: {
        type: DataTypes.ENUM('Active', 'Completed', 'Cancelled'),
        defaultValue: 'Active'
    },
    admission_status: {
        type: DataTypes.ENUM('reject', 'accepted', 'pending'),
        defaultValue: 'pending',
        allowNull: true,
        // comment: 'Status of the admission request, applicable if on_admission is true'
    },
    admission_note: {
        type: DataTypes.TEXT
    },
    visit_condition_state:{
        type: DataTypes.ENUM('stable', 'critical', 'serious'),
        allowNull: true,
    }
}, {
    timestamps: true,
    underscored: true,
    indexes: [

        {
            fields: ['visit_type'],
            unique: false
        },
        {
            fields: ['status'],
            unique: false
        }
    ],
    hooks: {
        beforeCreate: (visit, options) => {
            // Automatically generate a unique attendance number if not provided
            if (!visit.attendance_number) {
                visit.attendance_number = `ATN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            }
            // update admission date if admission is true
            if (visit.on_admission && !visit.admission_date) {
                visit.admission_date = new Date();
            }
            // Ensure institution_id is valid if provided
            if (visit.institution_id) {
                return Institution.findByPk(visit.institution_id)
                    .then(institution => {
                        if (!institution) {
                            throw new Error('Invalid institution_id provided');
                        }

                    });
            }

        }
    }

});
Visit.associate = (models) => {
    console.log(models.patientNote)
    Visit.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
    });
    Visit.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
    Visit.hasMany(models.VitalSignsRecord, {
        foreignKey: 'visit_id',
        as: 'vitalSignsRecords'
    });
    Visit.hasMany(models.Claim, {
        foreignKey: 'visit_id',
        as: 'claims',
        onDelete: 'CASCADE' // Delete visit if claim is deleted
    });
    Visit.hasMany(models.ClaimItem, {
        foreignKey: 'visit_id',
        as: 'claimItems'
    });
    Visit.hasMany(models.Prescription, {
        foreignKey: 'visit_id',
        as: 'prescriptions'
    });
    Visit.hasMany(models.LabTestResult, {
        foreignKey: 'visit_id',
        as: 'labTests'
    });
    // department
    Visit.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department'
    });
    Visit.hasMany(models.patientNote, { 
        foreignKey: 'visit_id',
        as: 'patientNote'
    });
    Visit.hasMany(models.Diagnosis, {
        foreignKey: 'visit_id',
        as: 'diagnosis'
    });
    Visit.hasMany(models.Appointment, {
        foreignKey: 'visit_id',
        as: 'appointments'
    });
    Visit.hasMany(models.Procedure, {
        foreignKey: 'visit_id',
        as: 'procedure'
    });
    Visit.hasMany(models.Invoice, {
        foreignKey: 'visit_id',
        as: 'invoice'
    });
    Visit.hasOne(models.ANC, { foreignKey: 'visit_id', as: 'anc_record' });
    // bed association
    Visit.belongsTo(models.Bed, { foreignKey: 'visit_id', as: 'bed' });
   

};

module.exports = Visit;


// EagerLoadingError [SequelizeEagerLoadingError]: VitalSignsRecord is not associated to Visit!
