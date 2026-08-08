'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('staffs', 'token', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn('staffs', 'logic_question', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.changeColumn('staffs', 'logic_answer_hash', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('staffs', 'token', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('staffs', 'logic_question', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('staffs', 'logic_answer_hash', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
};
