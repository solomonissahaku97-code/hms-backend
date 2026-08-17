'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_service_bills_service_type" ADD VALUE IF NOT EXISTS 'Service';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_service_bills_service_type" DROP VALUE IF EXISTS 'Service';
    `);
  }
};
