const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: true, // NULL for SUPER_ADMIN (platform-level)
    },

    // ── Identity ───────────────────────────────────────────
    username: {
        type: DataTypes.STRING(255),
        allowNull: true, // Admin/SuperAdmin have this
    },
    first_name: {
        type: DataTypes.TEXT, // Encrypted for migrated Staff
        allowNull: true,
    },
    middle_name: {
        type: DataTypes.TEXT, // Encrypted for migrated Staff
        allowNull: true,
    },
    last_name: {
        type: DataTypes.TEXT, // Encrypted for migrated Staff
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    phone: {
        type: DataTypes.TEXT, // Encrypted for migrated Staff
        allowNull: true,
    },

    // ── Authentication ─────────────────────────────────────
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    staff_id_code: {
        type: DataTypes.STRING(255),
        allowNull: true, // Staff.staffID — login identifier for staff
        unique: true,
    },
    token: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    token_expiration: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    // ── User Type ──────────────────────────────────────────
    user_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'STAFF',
        validate: {
            isIn: [['SUPER_ADMIN', 'ADMIN', 'STAFF', 'PATIENT']],
        },
    },

    // ── Profile ────────────────────────────────────────────
    profile_pic: {
        type: DataTypes.STRING(512),
        allowNull: true,
    },

    // ── Status ─────────────────────────────────────────────
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active',
        validate: {
            isIn: [['active', 'inactive', 'locked']],
        },
    },

    // ── Lockout (migrated from Admin) ──────────────────────
    login_attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    last_failed_attempt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    account_locked_until: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    // ── Verification (migrated from Admin) ─────────────────
    verification_token: {
        type: DataTypes.STRING(6),
        allowNull: true,
    },
    verification_expiration: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    // ── 2FA Logic (migrated from Staff) ────────────────────
    logic_question: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    logic_answer_hash: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // ── Legacy role_manager (kept for backward compat) ─────
    role_manager: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },

    // ── Patient portal ────────────────────────────────────
    must_change_password: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'True for patients using auto-generated password; cleared on first password change',
    },
    device_tokens: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON array of registered FCM device tokens for push notifications',
    },
}, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    indexes: [
        { fields: ['email'], unique: true },
        { fields: ['institution_id'] },
        { fields: ['user_type'] },
        { fields: ['staff_id_code'], unique: true, where: { staff_id_code: { [Op.ne]: null } } },
    ],
});

User.associate = (models) => {
    User.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    User.belongsToMany(models.Role, { through: 'user_roles', foreignKey: 'user_id', otherKey: 'role_id', timestamps: false, as: 'roles' });
    User.belongsToMany(models.Permission, { through: 'user_permissions', foreignKey: 'user_id', otherKey: 'permission_id', timestamps: false, as: 'permissions' });
};

module.exports = User;
