'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('institution_procedure_prices', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      institution_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'institutions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      gdrg_code_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'gdrg_codes',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      market_price: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      nhia_price: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('institution_procedure_prices', ['institution_id', 'gdrg_code_id'], {
      unique: true,
      name: 'unique_institution_procedure_price'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('institution_procedure_prices');
  }
};
