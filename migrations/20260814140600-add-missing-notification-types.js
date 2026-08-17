'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS 'Lab_Result';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS 'Stock_Issue';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS 'Stock_Request';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_notifications_type" DROP VALUE IF EXISTS 'Lab_Result';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_notifications_type" DROP VALUE IF EXISTS 'Stock_Issue';
    `);
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_notifications_type" DROP VALUE IF EXISTS 'Stock_Request';
    `);
  }
};
