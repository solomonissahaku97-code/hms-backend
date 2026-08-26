'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table already exists (idempotent)
    const [exists] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sync_operations') as exists`
    );
    if (exists[0].exists) {
      console.log('ℹ️  sync_operations table already exists — skipping');
      return;
    }

    await queryInterface.createTable('sync_operations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      operation_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      institution_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      entity: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      operation: {
        type: Sequelize.ENUM('CREATE', 'UPDATE', 'DELETE'),
        allowNull: false
      },
      record_id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      server_record_id: {
        type: Sequelize.UUID,
        allowNull: true
      },
      payload: {
        type: Sequelize.JSON,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed', 'conflict'),
        allowNull: false,
        defaultValue: 'pending'
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      last_error: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    await queryInterface.addIndex('sync_operations', ['operation_id']);
    await queryInterface.addIndex('sync_operations', ['institution_id', 'status']);
    await queryInterface.addIndex('sync_operations', ['entity', 'record_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sync_operations');
  }
};
