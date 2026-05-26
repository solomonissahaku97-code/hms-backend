const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');


const LeaveBalance = sequelize.define('LeaveBalance', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'staffs',
            key: 'id'
        },
    },
    leaveType: {
        type: DataTypes.ENUM(
            'Annual',
            'Sick',
            'Maternity',
            'Paternity',
            'Study'
        ),
        allowNull: false,
        unique: 'staff_leave_type_year'
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: new Date().getFullYear(),
        unique: 'staff_leave_type_year'
    },
    entitlement: {
        type: DataTypes.DECIMAL(5, 1),
        allowNull: false,
        comment: 'Total days entitled for this year'
    },
    carriedOver: {
        type: DataTypes.DECIMAL(5, 1),
        defaultValue: 0,
        comment: 'Days carried over from previous year'
    },
    taken: {
        type: DataTypes.DECIMAL(5, 1),
        defaultValue: 0,
        comment: 'Days already taken this year'
    },
    remaining: {
        type: DataTypes.DECIMAL(5, 1),
        comment: 'Calculated field: (entitlement + carriedOver) - taken'
    }
}, {
    timestamps: true,
    hooks: {
        beforeSave: (balance) => {
            // Auto-calculate remaining balance
            balance.remaining = (
                parseFloat(balance.entitlement || 0) + 
                parseFloat(balance.carriedOver || 0)
            ) - parseFloat(balance.taken || 0);
        }
        
    }
});





module.exports = LeaveBalance