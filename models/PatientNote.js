const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Staff = require('./staff');
const Institution = require('./institution');
const Visit = require('./Visit');



const PatientNote = sequelize.define('patientNote', {
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
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution,
            key: 'id'
        }
    },

    tagged_staff_ids: {
        type: DataTypes.ARRAY(DataTypes.UUID), // For PostgreSQL
        allowNull: true,
        defaultValue: [], // Default to an empty array
        
    },

    note: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    tableName: 'patient_notes', // Optional: specify the table name if different from the model name
    timestamps: true, // Automatically manage createdAt and updatedAt fields
    paranoid: true, // Enable soft deletion\
    underscored: true, // Use snake_case for column names
    indexes: [
        {
            fields: ['visit_id'],
            unique: false
        },
        {
            fields: ['staff_id'],
            unique: false
        },
        {
            fields: ['institution_id'],
            unique: false
        }
    ],
    hooks: {
        beforeCreate: (note, options) => {
            // Ensure note is not empty
            if (!note.note || note.note.trim() === '') {
                throw new Error('Note cannot be empty');
            }
        }
    }
})

PatientNote.associate = (models) => {
    PatientNote.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'notes' });
    PatientNote.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
    PatientNote.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    PatientNote.belongsTo(models.ChatAi, { foreignKey: 'id', as: 'ai_suggestions' });
    PatientNote.belongsToMany(models.Staff, { through: 'StaffTags', as: 'taggedStaffs', foreignKey: 'note_id' });
    PatientNote.hasMany(models.StaffComment, { foreignKey: 'patient_note_id', as: 'comments' });
}




module.exports = PatientNote; 
