const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Staff = require('../staff');
const Institution = require('../institution');
const Department = require('../department');

const StaffPayment = sequelize.define('StaffPayment', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
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
    basic_salary: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    bonus: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0.00
    },
    deductions: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0.00
    },
    net_pay: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    payment_month: {
        type: DataTypes.STRING(20),
        allowNull: false, // e.g., 'November 2025'
    },
    payment_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    payment_method: {
        type: DataTypes.ENUM('cash', 'bank_transfer', 'mobile_money', 'cheque'),
        allowNull: false,
        defaultValue: 'bank_transfer'
    },
    transaction_reference: {
        type: DataTypes.STRING,
        allowNull: true
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    processed_by: {
       type: DataTypes.UUID,
       allowNull: false,
       reference:{
        model:'staffs',
        key:'id'
       }
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'StaffPayment',
    tableName: 'staff_payments',
    timestamps: false
});

// Associations
StaffPayment.associate = (models) => {
    StaffPayment.belongsTo(models.Staff, {
        foreignKey: 'staff_id',
        as: 'staff'
    });
    StaffPayment.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
    StaffPayment.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department'
    });
};

module.exports = StaffPayment;
