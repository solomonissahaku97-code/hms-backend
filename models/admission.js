const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Staff = require('./staff');
const Record = require('./record');
const Institution = require('./institution');
const Visit = require('./Visit');

const Admission = sequelize.define('Admission', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Visit,
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
        },
        onDelete: 'CASCADE'
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
    admission_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    discharge_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('Admitted', 'Discharged', 'Transferred'),
        allowNull: false,
        defaultValue: 'Admitted'
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    bed_id: {
        type: DataTypes.UUID,
    }
}, {
    sequelize,
    modelName: 'Admission',
    timestamps: true,
    tableName: 'admissions'
});

Admission.associate = models => {
    Admission.belongsTo(models.Visit, { as: 'visit', foreignKey: 'visit_id', onDelete: 'CASCADE' });
    Admission.belongsTo(models.Institution, { as: 'institution', foreignKey: 'institution_id', onDelete: 'CASCADE' });
    Admission.belongsTo(models.Staff, { as: 'staff', foreignKey: 'staff_id', onDelete: 'CASCADE' });
    Admission.hasOne(models.Bed, { foreignKey: 'admission_id', as: 'bed', onDelete: 'CASCADE' });
};

module.exports = Admission;
