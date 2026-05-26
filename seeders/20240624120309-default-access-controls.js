'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('AccessControls', [
      { name: 'Access to Partograph', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Treatment Sheet', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Request for Items', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Vital Signs', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Patient Diagnosis', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Lab Request', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Billings', createdAt: new Date(), updatedAt: new Date() },
      { name: 'X-ray Request', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Consultation', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Permission 10', createdAt: new Date(), updatedAt: new Date() },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('AccessControls', null, {});
  },
};
