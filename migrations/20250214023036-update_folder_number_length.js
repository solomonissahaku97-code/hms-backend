'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("records", "folder_number", {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true, // Keeping it unique
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to the original length (8)
    await queryInterface.changeColumn("records", "folder_number", {
      type: Sequelize.STRING(8),
      allowNull: false,
      unique: true,
    });
  }
};
