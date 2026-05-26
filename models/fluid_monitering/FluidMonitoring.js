const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Visit = require('../Visit');
const Staff = require('../staff');
const Institution = require('../institution');


const FluidMonitoring = sequelize.define('FluidMonitoring', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Visit,
            key: 'id'
        }
    },

    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference: {
            model: Institution,
            key: 'id'
        }
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    type: {
        type: DataTypes.ENUM('intake', 'output'),
        allowNull: false
    },
    category: {
        type: DataTypes.ENUM('oral', 'iv', 'ng_tube', 'other_intake', 'urine', 'stool', 'vomit', 'drain', 'other_output'),
        allowNull: false
    },
    sub_category: {
        type: DataTypes.STRING,
        allowNull: true
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    unit: {
        type: DataTypes.ENUM('ml', 'l', 'oz'),
        defaultValue: 'ml'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    color: {
        type: DataTypes.ENUM('clear', 'pale_yellow', 'yellow', 'dark_yellow', 'amber', 'brown', 'red', 'other'),
        allowNull: true
    },
    consistency: {
        type: DataTypes.ENUM('liquid', 'soft', 'formed', 'hard', 'watery', 'mucoid', 'bloody'),
        allowNull: true
    },
    method: {
        type: DataTypes.ENUM('spontaneous', 'catheter', 'condom', 'ileostomy', 'colostomy', 'ng_tube', 'iv_line'),
        allowNull: true
    },
    fluid_type: {
        type: DataTypes.ENUM('water', 'juice', 'soup', 'normal_saline', 'dextrose', 'ringers_lactate', 'blood', 'other'),
        allowNull: true
    },
    iv_solution: {
        type: DataTypes.STRING,
        allowNull: true
    },
    iv_rate: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true
    },
    iv_rate_unit: {
        type: DataTypes.ENUM('ml/hr', 'drops/min'),
        allowNull: true
    },
    recorded_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    status: {
        type: DataTypes.ENUM('active', 'completed', 'cancelled', 'voided'),
        defaultValue: 'active'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    is_void: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    void_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: false
    },
    updated_by: {
        type: DataTypes.UUID,
        allowNull: true
    }
}, {
    tableName: 'fluid_monitoring',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['visit_id']
        },

        {
            fields: ['institution_id']
        },
        {
            fields: ['recorded_at']
        },
        {
            fields: ['type']
        },
        {
            fields: ['category']
        }
    ]
});

// Associations
FluidMonitoring.belongsTo(Visit, { foreignKey: 'visit_id', as: 'visit' });
FluidMonitoring.belongsTo(Staff, { foreignKey: 'staff_id', as: 'staff' });
FluidMonitoring.belongsTo(Staff, { foreignKey: 'created_by', as: 'creator' });
FluidMonitoring.belongsTo(Staff, { foreignKey: 'updated_by', as: 'updater' });

module.exports = FluidMonitoring;