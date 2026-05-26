// models/nurseHandover.js
const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const NurseHandover = sequelize.define('NurseHandover', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference: {
            model: 'visits',
            key: 'id'
        }
    },
    from_nurse_id: {
        type: DataTypes.UUID,
        allowNull: true,
        reference: {
            model: 'staffs',
            key: 'id'
        }
    },
    department_Id: {
        type: DataTypes.UUID,
        allowNull: false,
        reference: {
            model: 'departments',
            key: 'id'
        }
    },
    shift: {
        type: DataTypes.ENUM('morning', 'afternoon', 'night'),
        allowNull: false
    },
    ongoing_treatments: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Medications or treatments in progress during handover'
    },
    status: {
        type: DataTypes.ENUM('draft', 'submitted', 'acknowledged'),
        defaultValue: 'submitted',
    },

    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'nurse_handovers',
    timestamps: true
});

// association
NurseHandover.associate = (models) => {
    NurseHandover.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
    NurseHandover.belongsTo(models.Staff, { foreignKey: 'from_nurse_id', as: 'from_nurse' });
    NurseHandover.belongsTo(models.Staff, { foreignKey: 'to_nurse_id', as: 'to_nurse' });
}

module.exports = NurseHandover;
