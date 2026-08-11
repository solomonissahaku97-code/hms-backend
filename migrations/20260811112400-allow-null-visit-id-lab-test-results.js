'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("lab_test_results", "visit_id", {
      type: Sequelize.UUID,
      allowNull: true,
      onDelete: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("lab_test_results", "visit_id", {
      type: Sequelize.UUID,
      allowNull: false,
      onDelete: 'CASCADE'
    });
  }
};
