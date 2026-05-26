const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const LeaveRequest = sequelize.define('LeaveRequest', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    leaveType: {
        type: DataTypes.ENUM(
            'Annual',
            'Sick',
            'Maternity',
            'Paternity',
            'Study',
            'Unpaid',
            'Compensatory',
            'Other'
        ),
        allowNull: false
    },
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    durationDays: {
        type: DataTypes.DECIMAL(5, 1), // Supports half-day leaves
        allowNull: false
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM(
            'Pending',
            'Approved',
            'Rejected',
            'Cancelled'
        ),
        defaultValue: 'Pending'
    },
    approvedById: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        }
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    emergencyContact: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Required for certain leave types'
    },
    documentUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'For supporting documents'
    }
}, {
    timestamps: true,
    paranoid: true,
    indexes: [
        {
            fields: ['staff_id']
        },
        {
            fields: ['status']
        },
        {
            fields: ['startDate', 'endDate']
        }
    ]
});

LeaveRequest.associate = (models)=>{
    LeaveRequest.belongsTo(models.Staff,{ foreignKey:'staff_id',as:'leaveRequest' })
}


module.exports =  LeaveRequest