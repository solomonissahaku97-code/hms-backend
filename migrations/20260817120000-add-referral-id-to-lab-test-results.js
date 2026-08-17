'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('lab_test_results', 'referral_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'lab_referrals', key: 'id' },
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('lab_test_results', 'referral_id');
  }
};
