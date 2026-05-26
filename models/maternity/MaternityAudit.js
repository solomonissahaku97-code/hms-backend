// models/maternityAudit.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Institution = require('../institution');

const MaternityAudit = sequelize.define('MaternityAudit', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference: {
            model: 'visit',
            key: 'id'
        }
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference: {
            model: 'insstitution',
            key: 'id'
        }
    },

    audit_number: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },

    year: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    mother_age: {
        type: DataTypes.INTEGER,
        allowNull: true
    },

    parity: {
        type: DataTypes.INTEGER,
        allowNull: true
    },

    mode_of_delivery: {
        type: DataTypes.ENUM('SVD', 'Assisted', 'Caesarean', 'Other'),
        allowNull: false
    },

    anesthesia_type: {
        type: DataTypes.ENUM('Spinal', 'General', 'Other'),
        allowNull: true
    },

    baby_outcome: {
        type: DataTypes.ENUM('Alive with Mother', 'Alive without Mother', 'Stillborn', 'Other'),
        allowNull: false
    },

    baby_death_timing: {
        type: DataTypes.ENUM('<24h', '24-48h', '48h-7days', '≥7days'),
        allowNull: true
    },

    cause_of_death: {
        type: DataTypes.ENUM(
            'Bleeding',
            'Convulsion',
            'Vomiting',
            'Anaemia',
            'Severe cough',
            'Jaundice',
            'Other'
        ),
        allowNull: true,
        defaultValue:'Bleeding'
    },

    auditor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference: {
            model: 'staffs',
            key: 'id'
        }
    },


}, {
    tableName: 'maternity_audits',
    timestamps: true
});

// Associations
MaternityAudit.associate = (models) => {
    MaternityAudit.belongsTo(models.Visit, {
        foreignKey: 'visit_id',
        as: 'visit'
    });

    MaternityAudit.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
    });
};

// Hook to auto-generate audit_number
MaternityAudit.addHook('beforeCreate', async (audit, options) => {
    const year = audit.year || new Date().getFullYear();

    // Fetch institution to use its code/abbr (fallback to "INS")
    const institution = await Institution.findByPk(audit.institution_id);
    const code = institution?.name || 'INS';

    // Count existing audits for this institution + year
    const count = await MaternityAudit.count({
        where: {
            institution_id: audit.institution_id,
            year
        }
    });

    // Sequence number padded to 4 digits
    const sequence = String(count + 1).padStart(4, '0');

    audit.audit_number = `${code}-${year}-${sequence}`;
});


module.exports = MaternityAudit;
