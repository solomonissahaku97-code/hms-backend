'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add latitude and longitude columns to institutions table
    // These are optional — institutions without coordinates won't show distance
    const table = await queryInterface.describeTable('institutions');

    if (!table.latitude) {
      await queryInterface.addColumn('institutions', 'latitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
        comment: 'Institution latitude coordinate',
      });
    }

    if (!table.longitude) {
      await queryInterface.addColumn('institutions', 'longitude', {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
        comment: 'Institution longitude coordinate',
      });
    }

    // Add indexes for location-based queries
    try {
      await queryInterface.addIndex('institutions', ['latitude', 'longitude']);
    } catch (_) {
      // Index may already exist
    }
  },

  down: async (queryInterface) => {
    try {
      await queryInterface.removeIndex('institutions', ['latitude', 'longitude']);
    } catch (_) {}
    try {
      await queryInterface.removeColumn('institutions', 'longitude');
    } catch (_) {}
    try {
      await queryInterface.removeColumn('institutions', 'latitude');
    } catch (_) {}
  },
};
