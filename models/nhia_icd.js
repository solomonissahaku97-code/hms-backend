const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NHIA_ICD = sequelize.define("NHIA_ICD", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: "nhia_icd",
    timestamps: false
});

module.exports = NHIA_ICD;
