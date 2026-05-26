const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Institution = require('./institution');
const Visit = require('./Visit');


const Consultation = sequelize.define('consultation', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,

        defaultValue: DataTypes.UUIDV4
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Institution, // Make sure this matches your Institution model's table name
            key: 'id'
        },
        onDelete: 'CASCADE' // Delete contact info if institution is deleted
    },

    visit_id :{
        type:DataTypes.UUID,
        allowNull:false,
        references:{
            model:Visit,
            as:'id'
        }
    },
    status:{
        type:DataTypes.ENUM('pending','approved'),
    }
 

},{
    tableName: 'consultation',
    timestamps: true
})

Consultation.associate = (models)=>{
    Consultation.belongsTo(models.Record,{foreignKey:'visit_id',as:'patient'})
}


module.exports = Consultation;
