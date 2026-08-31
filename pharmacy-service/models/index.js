const sequelize = require('../config/database');
const Medication = require('./Medication');
const DrugBatch = require('./DrugBatch');
const Prescription = require('./Prescription');
const PrescriptionItem = require('./PrescriptionItem');
const DispenseRecord = require('./DispenseRecord');
const InventoryLog = require('./InventoryLog');
const PharmacyAudit = require('./PharmacyAudit');
const InstitutionPharmacyPrice = require('./InstitutionPharmacyPrice');

const models = {
  Medication,
  DrugBatch,
  Prescription,
  PrescriptionItem,
  DispenseRecord,
  InventoryLog,
  PharmacyAudit,
  InstitutionPharmacyPrice,
};

// Run associations
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  ...models,
  sequelize,
};
