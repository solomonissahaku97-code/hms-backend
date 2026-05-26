const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Procedure = require('./procedure/procedure');
const Staff = require('./staff');

const ProcedureStaff = sequelize.define('ProcedureStaff', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    procedure_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Procedure,
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
    role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'assistant'
    }
}, {
    tableName: 'procedure_staff',
    timestamps: false
});

// ProcedureStaff.associate = (models) => {
//     ProcedureStaff.belongsTo(models.Procedure, { foreignKey: 'procedure_id', as: 'procedure' });
//     ProcedureStaff.belongsToMany(models.Staff, { foreignKey: 'staff_id', as: 'staff',through:models.Staff });
// };


module.exports = ProcedureStaff;