const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Institution = require('./institution');
const Department = require('./department');
const Staff = require('./staff');
const Visit = require('./Visit');

const DoctorsNote = sequelize.define('DoctorsNote', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: false,
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
        references: {
            model: Institution,
            key: 'id'
        }
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Department,
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
    priority:{
        type:DataTypes.ENUM("low","medium","high","critical"),
        defaultValue:"medium",
        allowNull:true
    },

    is_signed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },

    signed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },

    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    tableName: 'doctors_notes',
    timestamps: false,
});

// Define associations separately using associate function
DoctorsNote.associate = (models) => {
    DoctorsNote.belongsTo(models.Visit, { foreignKey: 'visit_id' });
    DoctorsNote.belongsTo(models.Institution, { foreignKey: 'institution_id' });
    DoctorsNote.belongsTo(models.Department, { foreignKey: 'department_id' });
    DoctorsNote.belongsTo(models.Staff, { foreignKey: 'staff_id' });
};

module.exports = DoctorsNote;
