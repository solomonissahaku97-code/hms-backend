const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const Staff = require('../staff');
const GDRGCode = require('./GDRGCode');
const systemDiagnosis = require('./systemDiagnosis');

const ClaimItem = sequelize.define('ClaimItem', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    claim_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'claims',
            key: 'id'
        }
    },
    item_type: {
        type: DataTypes.ENUM('LabTest', 'Medication', 'Consultation', 'Procedure', 'Service', 'Diagnosis'),
        allowNull: false
    },
    item_id: {
        type: DataTypes.UUID,

    },
    gdrg_code: {
        type: DataTypes.STRING
    },
    description: {
        type: DataTypes.STRING
    },
    unit_price: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    nhia_amount: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    actual_amount: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    co_payment: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    paid_by_patient: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    performed_by: {
        type: DataTypes.UUID,
        references: {
            model: Staff,
            key: 'id'
        }
    },
    corresponding_diagnosis_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: systemDiagnosis, // use your actual table name
            key: "id"
        }
    },

    date_performed: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: true,
    tableName: 'claim_items',
    underscored: true,
    comment: 'Items associated with a claim, such as lab tests, medications, consultations, etc.',
    hooks: {
        beforeCreate: async (item, options) => {
            const models = sequelize.models;

            // Auto-calculate amount if not provided
            if (!item.amount) {
                item.amount = (item.unit_price || 0) * (item.quantity || 1);
            }
            const findOptions = { transaction: options.transaction };
            // Validate item_id based on item_type
            switch (item.item_type) {
                case 'LabTest':
                    if (!(await models.LabTestResult.findByPk(item.item_id))) {
                        throw new Error('LabTest not found');
                    }
                    break;

                case 'Medication':
                    if (!(await models.Prescription.findByPk(item.item_id))) {
                        throw new Error('Prescription not found');
                    }
                    break;

                case 'Diagnosis':
                    if (!(await models.Diagnosis.findByPk(item.item_id, findOptions))) {
                        console.log('Diagnosis item type is being processed', item.item_id);
                        throw new Error('Diagnosis not found');
                    }
                    break;

                // Add cases for other item_types as needed
            }
        },
        beforeDestroy: async (claimItem, options) => {
            const models = sequelize.models;
            const transaction = options.transaction;

            // Verify the associated item exists before attempting to delete
            let associatedItemExists = false;

            switch (claimItem.item_type) {
                case 'LabTest':
                    associatedItemExists = !!(await models.LabTestResult.findByPk(claimItem.item_id, { transaction }));
                    break;

                case 'Medication':
                    associatedItemExists = !!(await models.Prescription.findByPk(claimItem.item_id, { transaction }));
                    break;

                case 'Diagnosis':
                    associatedItemExists = !!(await models.Diagnosis.findByPk(claimItem.item_id, { transaction }));
                    break;
            }


        }

        // ... other hooks ...
    }
});


// association
ClaimItem.associate = (models) => {
    ClaimItem.belongsTo(models.Staff, { foreignKey: 'performed_by', as: 'staff' }),
        // claim‑item.js  (after every model has been imported)
        ClaimItem.belongsTo(models.LabResult, {
            foreignKey: 'item_id',
            constraints: false,      // disable the DB‑level FK ; we’ll validate in a hook
            as: 'labTest',
        });

    ClaimItem.belongsTo(models.Prescription, {
        foreignKey: 'item_id',
        constraints: false,
        as: 'prescription',
    });

    ClaimItem.belongsTo(models.Procedure, {
        foreignKey: 'item_id',
        constraints: false,
        as: 'procedure',
    });
    ClaimItem.belongsTo(models.Service, {
        foreignKey: 'item_id',
        constraints: false,
        as: 'service',
    });
    // associate to claims
    ClaimItem.belongsTo(models.Claim, {
        foreignKey: 'claim_id',
        as: 'claim'
    });

    ClaimItem.belongsTo(models.Diagnosis, {
        foreignKey: 'item_id',
        as: 'diagnosis',
        constraints: false,
    });
    ClaimItem.belongsTo(models.GDRGCode, {
        foreignKey: 'corresponding_diagnosis_id',
        as: 'gdrgCodeDetails',
        constraints: false,
    });
}








module.exports = ClaimItem;
