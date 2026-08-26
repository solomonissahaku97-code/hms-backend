'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table already exists (idempotent)
    const [exists] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lab_result_share_tokens') as exists`
    );
    if (exists[0].exists) {
      console.log('ℹ️  lab_result_share_tokens table already exists — skipping');
      return;
    }

    await queryInterface.createTable('lab_result_share_tokens', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      lab_result_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'lab_test_results',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      institution_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'institutions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      token_hash: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true,
        comment: 'SHA-256 hash of the token — raw token is never stored',
      },
      token_prefix: {
        type: Sequelize.STRING(8),
        allowNull: false,
        comment: 'First 8 chars of token for identification/debugging',
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Token expiration timestamp',
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'If set, token is revoked and no longer valid',
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Staff member who generated the token',
      },
      last_accessed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last time the patient accessed this link',
      },
      access_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of times the link has been accessed',
      },
      sms_sent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      sms_sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Indexes
    await queryInterface.addIndex('lab_result_share_tokens', ['token_hash'], {
      unique: true,
    });
    await queryInterface.addIndex('lab_result_share_tokens', ['lab_result_id']);
    await queryInterface.addIndex('lab_result_share_tokens', ['institution_id']);
    await queryInterface.addIndex('lab_result_share_tokens', ['expires_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lab_result_share_tokens');
  },
};
