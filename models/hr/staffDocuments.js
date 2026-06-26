const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
const Staff = require("../staff");

const DocumentsAndLicenses = sequelize.define(
  "documents",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    institution_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    staff: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Staff,
        key: "id",
      },
    },

    document_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    document_type: {
      type: DataTypes.ENUM(
        "License",
        "Certificate",
        "Contract",
        "ID Card",
        "Passport",
        "Insurance",
        "Qualification",
        "Other"
      ),
      allowNull: false,
    },

    document_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    issuing_authority: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    issue_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    file_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "Active",
        "Expired",
        "Pending",
        "Revoked"
      ),
      defaultValue: "Active",
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "documents_and_licenses",
  }
);

// Associations
Staff.hasMany(DocumentsAndLicenses, {
  foreignKey: "staff",
});

DocumentsAndLicenses.belongsTo(Staff, {
  foreignKey: "staff",
});

module.exports = DocumentsAndLicenses;