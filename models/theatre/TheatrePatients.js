const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const TheatrePatients = sequelize.define('TheatrePatients', {
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
    procedure_ids: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: []
    },
    procedure_names: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: []
    },
    scheduled_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Scheduled date for the theatre procedure'
    },
    scheduled_time: {
        type: DataTypes.TIME,
        allowNull: true,
        comment: 'Scheduled time for the theatre procedure'
    },
    estimated_duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Estimated duration in minutes'
    },
    actual_start_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Actual surgery start time'
    },
    actual_end_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Actual surgery end time'
    },
    room_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Assigned operating room'
    },
    surgeon_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    anaesthetist_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    scrub_nurse_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    circulating_nurse_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    diagnosis_id: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: []
    },
    diagnosis_names: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: []
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes regarding the theatre procedure'
    },
    pre_op_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Pre-operative notes'
    },
    intra_op_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Intra-operative notes'
    },
    post_op_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Post-operative notes'
    },
    is_emergency: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    status: {
        type: DataTypes.ENUM(
            'scheduled', 
            'pre-operation', 
            'intra-operation', 
            'post-operation',
            'completed',
            'cancelled',
            'postponed'
        ),
        allowNull: true,
        defaultValue: 'scheduled'
    },
    cancellation_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for cancellation if cancelled'
    },
    cancellation_by: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Staff who cancelled the surgery'
    },
    outcome: {
        type: DataTypes.STRING, // Changed from ENUM to STRING to avoid migration issues
        allowNull: true,
        defaultValue: 'pending',
        comment: 'Surgery outcome'
    },
    blood_loss_ml: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Blood loss in milliliters'
    },
    specimens_collected: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Number of specimens collected'
    },
    implants_used: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of implants used'
    },
    complications: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Any complications during surgery'
    },
    discharge_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date patient was discharged from recovery'
    },
    discharge_condition: {
        type: DataTypes.STRING, // Changed from ENUM to STRING to avoid migration issues
        allowNull: true,
        comment: 'Condition at discharge from recovery'
    }
}, {
    tableName: 'theatre_patients',
    timestamps: true,
    underscored: true
});

// Update associations - remove the single procedure association
TheatrePatients.associate = (models) => {
    TheatrePatients.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });

    TheatrePatients.belongsTo(models.Staff, {
        foreignKey: 'surgeon_id',
        as: 'surgeon'
    });
    TheatrePatients.belongsTo(models.Staff, {
        foreignKey: 'anaesthetist_id',
        as: 'anaesthetist'
    });
    TheatrePatients.belongsTo(models.Staff, {
        foreignKey: 'scrub_nurse_id',
        as: 'scrubNurse'
    });
    TheatrePatients.belongsTo(models.Staff, {
        foreignKey: 'circulating_nurse_id',
        as: 'circulatingNurse'
    });
    TheatrePatients.belongsTo(models.OperatingRoom, {
        foreignKey: 'room_id',
        as: 'operatingRoom'
    });
}

module.exports = TheatrePatients;