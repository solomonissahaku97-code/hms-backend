const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Staff = require('../staff');
const Institution = require('../institution');
const Department = require('../department');
// const Institution = require('./institution');
// const Department = require('./department');
// const Staff = require('./staff');

const Meeting = sequelize.define('Meeting', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: Department,
            key: 'id',
        },
        onDelete: 'SET NULL',
    },
    host_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Staff,
            key: 'id',
        },
        onDelete: 'CASCADE', 
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    room_name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    meeting_url: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    participants: {
        type: DataTypes.JSON, // e.g. ["staff_id_1", "staff_id_2"]
        allowNull: true,
    },
    isScheduled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    scheduled_time: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    duration_minutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 30,
    },
    status: {
        type: DataTypes.ENUM('scheduled', 'ongoing', 'completed', 'cancelled'),
        defaultValue: 'scheduled',
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    sequelize,
    modelName: 'Meeting',
    tableName: 'meetings',
    timestamps: true,
});

// 🔗 Associations
Meeting.associate = (models) => {
    Meeting.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution',
        onDelete: 'CASCADE',
    });
    Meeting.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department',
        onDelete: 'SET NULL',
    });
    Meeting.belongsTo(models.Staff, {
        foreignKey: 'host_id',
        as: 'host',
        onDelete: 'CASCADE', 
    });
};

module.exports = Meeting;
