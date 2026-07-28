const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Patient = require('./patient');
const Department = require('./department');
const Admin = require('./admin');
const Institution = require('./institution');
const Staff = require('./staff');
const Invoice = require('./Invoice');
const Visit = require('./Visit');


const Procedure = require('./procedure/procedure');
const Prescription = require('./prescription');
const LabTestResult = require('./lab/LabTestResult');

const ServiceBill = sequelize.define('ServiceBill', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    visit_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Visit, key: 'id' }
    },
    patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Patient, key: 'id' }
    },
    institution_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: Institution, key: 'id' }
    },
    department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Department, key: 'id' }
    },
    service_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    service_type: {
        type: DataTypes.ENUM('Medication', 'LabTest', 'Procedure', 'Consultation', 'Other'),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    unit_price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    nhia_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0.00
    },
    patient_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    admin_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Admin, key: 'id' }
    },
    staff_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Staff, key: 'id' }
    },
    invoice_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: Invoice, key: 'id' }
    },
    has_paid: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    payment_status: {
        type: DataTypes.ENUM('Pending', 'Paid', 'Overdue'),
        defaultValue: 'Pending'
    },
    is_nhia_covered: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    timestamps: false,
    modelName: 'ServiceBill',
    tableName: 'service_bills',
    hooks: {
        beforeCreate: (serviceBill, options) => {
            computeAmounts(serviceBill);
        },
        beforeUpdate: (serviceBill, options) => {
            computeAmounts(serviceBill);
        },
    }
});

function computeAmounts(serviceBill) {
    const pa = parseFloat(serviceBill.patient_amount || 0);
    const na = parseFloat(serviceBill.nhia_amount || 0);

    if (serviceBill.total_amount) {
        serviceBill.patient_amount = parseFloat(serviceBill.total_amount) - na;
        if (serviceBill.patient_amount < 0) serviceBill.patient_amount = 0;
    } else if (serviceBill.patient_amount !== undefined) {
        serviceBill.total_amount = pa + na;
    } else if (na > 0) {
        serviceBill.total_amount = na;
        serviceBill.patient_amount = 0;
    }

    if (parseFloat(serviceBill.patient_amount || 0) < 0) {
        serviceBill.patient_amount = 0;
    }
}

// Associations 
ServiceBill.associate = (models) => {
    ServiceBill.belongsTo(models.Visit, { foreignKey: 'visit_id', as: 'visit' });
    ServiceBill.belongsTo(models.Patient, { foreignKey: 'patient_id', as: 'patient' });
    ServiceBill.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    ServiceBill.belongsTo(models.Admin, { foreignKey: 'admin_id', as: 'admin' });
    ServiceBill.belongsTo(models.Staff, { foreignKey: 'staff_id', as: 'staff' });
    ServiceBill.belongsTo(models.Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
    ServiceBill.belongsTo(models.Institution, { foreignKey: 'institution_id', as: 'institution' });
    ServiceBill.hasOne(models.Payment, { foreignKey: 'service_bill_id', as: 'payment' });
    ServiceBill.hasMany(models.ClaimItem, { foreignKey: 'service_bill_id', as: 'claimItems' });
};

// Instance method to get the related service
ServiceBill.prototype.getService = async function() {
    switch (this.service_type) {
        case 'Medication':
            return await Prescription.findByPk(this.service_id);
        case 'LabTest':
            return await LabTestResult.findByPk(this.service_id);
        case 'Procedure':
            return await Procedure.findByPk(this.service_id);
        default:
            return null;
    }
};

module.exports = ServiceBill;