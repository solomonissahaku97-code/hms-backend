'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('claims', 'total_nhia_amount', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('claims', 'total_patient_amount', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('claims', 'total_nhia_amount');
    await queryInterface.removeColumn('claims', 'total_patient_amount');
  }
};
