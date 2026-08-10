'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = [
      { name: 'token', type: Sequelize.STRING, allowNull: true, comment: 'Shareable token for public appointment viewing' },
      { name: 'sms_sent', type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      { name: 'sms_sent_at', type: Sequelize.DATE, allowNull: true },
      { name: 'viewed_count', type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      { name: 'viewed_at', type: Sequelize.DATE, allowNull: true }
    ];

    for (const col of columns) {
      try {
        await queryInterface.addColumn('appointments', col.name, {
          type: col.type,
          allowNull: col.allowNull,
          defaultValue: col.defaultValue,
          ...(col.comment ? { comment: col.comment } : {})
        });
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          continue;
        }
        throw err;
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    const columns = ['token', 'sms_sent', 'sms_sent_at', 'viewed_count', 'viewed_at'];
    for (const col of columns) {
      try {
        await queryInterface.removeColumn('appointments', col);
      } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
          continue;
        }
        throw err;
      }
    }
  }
};
