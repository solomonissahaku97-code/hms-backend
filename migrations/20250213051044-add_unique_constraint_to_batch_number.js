'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ensure batch_number is NOT NULL first
    await queryInterface.changeColumn('batches', 'batch_number', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });

    // Add a UNIQUE constraint
    await queryInterface.addConstraint('batches', {
      fields: ['batch_number'],
      type: 'unique',
      name: 'unique_batch_number_constraint'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the UNIQUE constraint
    await queryInterface.removeConstraint('batches', 'unique_batch_number_constraint');

    // Revert column changes
    await queryInterface.changeColumn('batches', 'batch_number', {
      type: Sequelize.STRING(255),
      allowNull: true, // If it was nullable before
    });
  }
};
