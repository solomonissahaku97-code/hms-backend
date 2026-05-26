// models/PNC.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Institution = require('../institution');

const PNC = sequelize.define('PNC', {
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
    pnc_number: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    mother_condition: {
        type: DataTypes.ENUM('Good', 'Complicated', 'Needs Attention', 'Other'),
        allowNull: false
    },
    baby_condition: {
        type: DataTypes.ENUM('Healthy', 'Needs Attention', 'Sick', 'Other'),
        allowNull: false
    },
    baby_weight_kg: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    breastfeeding_status: {
        type: DataTypes.ENUM('Exclusive', 'Mixed', 'Not Breastfeeding'),
        allowNull: true
    },
    follow_up_needed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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
    tableName: 'pnc_records',
    timestamps: true
});

// Associations
PNC.associate = (models) => {
    PNC.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
    PNC.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
};

// Hook to auto-generate PNC number
PNC.addHook('beforeCreate', async (pnc, options) => {
    const year = pnc.year || new Date().getFullYear();
    const institution = await Institution.findByPk(pnc.institution_id);
    const code = institution?.name || 'INS';
    const count = await PNC.count({ where: { institution_id: pnc.institution_id, year } });
    const sequence = String(count + 1).padStart(4, '0');
    pnc.pnc_number = `${code}-PNC-${year}-${sequence}`;
});

module.exports = PNC;
