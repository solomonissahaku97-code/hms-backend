'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sms_subscriptions', {
      id: {
        type: Sequelize.UUID, 
        primaryKey: true,
        
        allowNull: false,
      },
      institution_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'institutions', // Ensure this matches the name of your institution table
          key: 'id',
        },
        onUpdate: 'CASCADE', // Ensures that updates to institution_id cascade to this table
        onDelete: 'SET NULL', // Ensure deletion of institution sets institution_id to null in this table
      },
      total_sms: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10, // Default value for total SMS
      },
      sms_used: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0, // Default value for SMS usage
      },
      extra_sms_purchased: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0, // Default value for extra SMS purchased
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('sms_subscriptions');
  }
};
