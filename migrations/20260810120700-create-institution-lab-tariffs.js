'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('institution_lab_tariffs', {
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
      lab_investigation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'lab_investigations',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      tariff_ghc: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      market_price: {
        type: Sequelize.DECIMAL(10, 2),
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

    await queryInterface.addIndex('institution_lab_tariffs', ['institution_id', 'lab_investigation_id'], {
      unique: true,
      name: 'unique_institution_lab_tariff'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('institution_lab_tariffs');
  }
};
