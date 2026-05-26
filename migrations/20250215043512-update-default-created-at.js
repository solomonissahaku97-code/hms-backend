'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Set default timestamp for existing records where created_at is NULL
    await queryInterface.sequelize.query(`
      UPDATE vital_signs_records 
      SET created_at = NOW() 
      WHERE created_at IS NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Optionally, set created_at to NULL if the migration is reverted
    await queryInterface.sequelize.query(`
      UPDATE vital_signs_records 
      SET created_at = NULL 
      WHERE created_at = NOW();
    `);
  }
};
