// models/ANC.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const ANC = sequelize.define('ANC', {
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
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'institutions',
            key: 'id'
        }
    },
    anc_number: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true   // 👈 allow null at creation, hook will populate
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: true   // 👈 allow null, hook will set it
    },
    mother_age: DataTypes.INTEGER,
    parity: DataTypes.INTEGER,
    gestational_age_weeks: DataTypes.INTEGER,
    blood_pressure: DataTypes.STRING,
    hemoglobin_level: DataTypes.FLOAT,
    hiv_status: {
        type: DataTypes.ENUM('Positive', 'Negative', 'Unknown'),
        allowNull: true
    },
    auditor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'staffs',
            key: 'id'
        }
    }
}, {
    tableName: 'anc_records',
    timestamps: true
});

// Associations
ANC.associate = (models) => {
    ANC.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
    ANC.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    ANC.belongsTo(models.Staff,{ foreignKey:'auditor_id',as:'auditor' })
};

// Hook to auto-generate ANC number
ANC.addHook('beforeCreate', async (anc, options) => {
    // Ensure year is set
    if (!anc.year) {
        anc.year = new Date().getFullYear();
    }

    // Use sequelize.models to avoid require-loop issues
    const Institution = sequelize.models.Institution;
    const institution = await Institution.findByPk(anc.institution_id);

    const code = institution?.code || institution?.name?.slice(0, 3).toUpperCase() || 'INS';

    const count = await ANC.count({
        where: { institution_id: anc.institution_id, year: anc.year }
    });

    const sequence = String(count + 1).padStart(4, '0');
    anc.anc_number = `${code}-ANC-${anc.year}-${sequence}`;
});

module.exports = ANC;
