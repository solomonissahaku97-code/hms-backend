'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('appointments', 'token', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Shareable token for public appointment viewing'
    });

    await queryInterface.addColumn('appointments', 'sms_sent', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('appointments', 'sms_sent_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('appointments', 'viewed_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn('appointments', 'viewed_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('appointments', 'token');
    await queryInterface.removeColumn('appointments', 'sms_sent');
    await queryInterface.removeColumn('appointments', 'sms_sent_at');
    await queryInterface.removeColumn('appointments', 'viewed_count');
    await queryInterface.removeColumn('appointments', 'viewed_at');
  }
};
