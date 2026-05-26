const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const CaseCart = sequelize.define('CaseCart', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    cart_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        // comment: 'Unique case cart number (e.g., CC-2023-0456)'
    },
    theatre_booking_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'theatre_patients',
            key: 'id'
        },
        comment: 'Reference to the theatre booking/patient'
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'visits',
            key: 'id'
        },
        comment: 'Patient associated with this case cart'
    },
    procedure: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The surgical procedure'
    },
    surgeon_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        },
        comment: 'Assigned surgeon'
    },
    surgeon_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Surgeon name for display'
    },
    scheduled_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Scheduled surgery date'
    },
    scheduled_time: {
        type: DataTypes.TIME,
        allowNull: true,
        comment: 'Scheduled surgery time'
    },
    status: {
        type: DataTypes.ENUM(
            'not-started',
            'in-progress',
            'ready',
            'confirmed',
            'used',
            'cancelled'
        ),
        allowNull: false,
        defaultValue: 'not-started'
    },
    completion_percentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0,
            max: 100
        },
        comment: 'Completion percentage of case cart preparation'
    },
    assigned_to: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        },
        comment: 'Staff member assigned to prepare this case cart'
    },
    assigned_to_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Assigned staff name for display'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes for the case cart'
    },
    priority: {
        type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'normal'
    },
    operating_room_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'operating_rooms',
            key: 'id'
        },
        comment: 'Assigned operating room'
    },
    confirmed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the case cart was confirmed'
    },
    confirmed_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        },
        comment: 'Staff who confirmed the case cart'
    }
}, {
    tableName: 'case_carts',
    timestamps: true,
    underscored: true
});

// Define associations
CaseCart.associate = (models) => {
    CaseCart.belongsTo(models.TheatrePatients, {
        foreignKey: 'theatre_booking_id',
        as: 'theatreBooking'
    });
    CaseCart.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'patient'
    });
    CaseCart.belongsTo(models.Staff, {
        foreignKey: 'surgeon_id',
        as: 'surgeon'
    });
    CaseCart.belongsTo(models.Staff, {
        foreignKey: 'assigned_to',
        as: 'assignedStaff'
    });
    CaseCart.belongsTo(models.Staff, {
        foreignKey: 'confirmed_by',
        as: 'confirmer'
    });
    CaseCart.belongsTo(models.OperatingRoom, {
        foreignKey: 'operating_room_id',
        as: 'operatingRoom'
    });
    CaseCart.hasMany(models.CaseCartItem, {
        foreignKey: 'case_cart_id',
        as: 'items'
    });
};

module.exports = CaseCart;

