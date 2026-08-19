'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if column already exists
    const [columns] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'lab_test_results' AND column_name = 'referral_id'`
    );

    if (columns.length > 0) {
      console.log('ℹ️  referral_id column already exists on lab_test_results — skipping');
      return;
    }

    await queryInterface.addColumn('lab_test_results', 'referral_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'lab_referrals', key: 'id' },
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    const [columns] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'lab_test_results' AND column_name = 'referral_id'`
    );
    if (columns.length > 0) {
      await queryInterface.removeColumn('lab_test_results', 'referral_id');
    }
  }
};
