const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const LicenseAndCertificate = sequelize.define('LicenseAndCertificate', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'staffs', // This references the Staff table
            key: 'id'
        }
    },
    licenseNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Clinician PIN/License Number'
    },
    issuingAuthority: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'e.g., Medical & Dental Council'
    },
    licenseExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    documentUrl: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'URL to the uploaded License Document (PDF/image)'
    },
    verificationStatus: {
        type: DataTypes.ENUM('Verified', 'Pending'),
        defaultValue: 'Pending',
        allowNull: false
    },
    lastReminderSent: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Date when the last expiry reminder was sent'
    }
}, {
    timestamps: true,
    paranoid: true, // Enable soft deletion
    indexes: [
        {
            fields: ['staff_id']
        },
        {
            fields: ['licenseExpiryDate'],
            where: {
                verificationStatus: 'Verified'
            }
        }
    ],
    hooks: {
        beforeSave: async (license, options) => {
            // Ensure license number is unique per staff
            const existingLicense = await LicenseAndCertificate.findOne({
                where: {
                    staff_id: license.staff_id,
                    licenseNumber: license.licenseNumber,
                    id: { [DataTypes.Op.ne]: license.id } // Exclude current record
                }
            });

            if (existingLicense) {
                throw new Error('License number must be unique for each staff member.');
            }
            
        }
    }
});

module.exports = LicenseAndCertificate;