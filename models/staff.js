const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Department = require('./department');
const Admin = require('./admin');
const Role = require('./role');
const UserGroup = require('./userGroup');
const { decrypt } = require('../utils/encryption'); // ✅ IMPORT THIS

const Staff = sequelize.define('Staff', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('firstName');
            return this.decryptField(rawValue);
        }
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('lastName');
            return this.decryptField(rawValue);
        }
    },
    middleName: {
        type: DataTypes.STRING,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('middleName');
            return this.decryptField(rawValue);
        }
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('email');
            return this.decryptField(rawValue);
        }
    },
    phone_number: {
        type: DataTypes.STRING,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('phone_number');
            return this.decryptField(rawValue);
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    },
    logic_question: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    logic_answer_hash: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    admin_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Admin,
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
    token: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    token_expiration: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    staffID: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
   
    role_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Role,
            key: 'id'
        }
    },
    profile_pic: {
        type: DataTypes.STRING,
        allowNull: true
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    permissions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    is_incharge: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    has_face_registered: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    role_manager: {
        type: DataTypes.STRING(10),
        defaultValue: 'staff',
        allowNull: false,
        validate: {
            is: /^staff$/ // Only allows the string "admin"
        }
    },
}, {
    sequelize,
    modelName: 'Staff',
    tableName: 'staffs',
    timestamps: false,
});

// Add instance method for decryption
Staff.prototype.decryptField = function(value) {
    if (!value || typeof value !== 'string') return value;
    try {
        return decrypt(value); // ✅ Now decrypt is defined
    } catch (error) {
        console.warn('Decryption failed:', error.message);
        return value;
    }
};

// If you need raw encrypted values sometimes, add this:
Staff.prototype.getEncryptedField = function(fieldName) {
    return this.getDataValue(fieldName);
};

// Define associations
Staff.associate = (models) => {
    Staff.hasMany(models.StaffComment, { as: 'author', foreignKey: 'staff_id' })
    Staff.hasMany(models.Meeting, { foreignKey: 'doctor_id', as: 'meeting' });
    Staff.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    Staff.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    Staff.belongsTo(models.Admin, { foreignKey: 'admin_id', as: 'admin' });
    Staff.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
    Staff.hasMany(models.Diagnosis, { foreignKey: 'staff_id', as: 'diagnosis' });
    Staff.hasMany(models.Appointment, { foreignKey: 'staff_id', as: 'appointments' })
    Staff.hasMany(models.Message, { foreignKey: 'senderId', as: 'messages' });

    // Cascade delete for related records
    Staff.hasMany(models.Diagnosis, { foreignKey: 'staff_id', as: 'diagnoses_', onDelete: 'CASCADE' });
    Staff.hasMany(models.RotationStaff, { foreignKey: 'staff_id', as: 'rotation', onDelete: 'CASCADE' });

    Staff.belongsToMany(models.UserGroup, { through: UserGroup, foreignKey: 'staff_id', as: 'user_group' })
    Staff.belongsToMany(models.Procedure, {
        through: models.ProcedureStaff,
        foreignKey: 'staff_id',
        otherKey: 'procedure_id',
        as: 'procedures',
    });
    Staff.hasMany(models.MessageReadReceipt, { foreignKey: 'userId', as: 'readReceipts' });
    Staff.hasMany(models.Chat, { as: 'SentMessages', foreignKey: 'senderId' });
    Staff.hasMany(models.Chat, { as: 'ReceivedMessages', foreignKey: 'receiverId' });
    Staff.hasMany(models.Attendance, { foreignKey: 'staffId', as: 'attendance' });
    Staff.hasMany(models.LeaveRequest, { foreignKey: 'staff_id', as: 'leaveRequest' });
    Staff.hasMany(models.StaffFace, { foreignKey: 'staff_id', as: 'faces' });

    Staff.hasMany(models.StaffDepartment, {
        foreignKey: 'staff_id',
        as: 'staff_departments'
    });
    Staff.hasMany(models.StaffPayment, { foreignKey: 'staff_id', as: 'payments' });

};

module.exports = Staff;