'use strict';

/**
 * FIX: Referral Table Naming Mismatch
 *
 * PROBLEM:
 *   - Production DB has table "referrals" (old institution-to-institution model)
 *   - Code expects "lab_referrals" (new lab referral model)
 *   - Migration 20260814000000 tried to create "lab_referrals" but likely failed
 *     because Sequelize migration tracking marked it as executed (even though
 *     the table creation may have partially failed).
 *
 * SOLUTION:
 *   - If "lab_referrals" already exists → skip (already fixed)
 *   - If "referrals" exists → rename to "referrals_old" (backup)
 *   - Create "lab_referrals" with correct schema
 *   - Create "lab_referral_items" with correct schema
 *   - Add "referral_id" to "lab_test_results" if missing
 *
 * This is idempotent and safe for both fresh and existing databases.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if lab_referrals already exists — if so, nothing to do
    const [labReferralsExists] = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lab_referrals'
      ) as exists`
    );

    if (labReferralsExists[0].exists) {
      console.log('✅ lab_referrals table already exists — skipping fix migration');
      return;
    }

    console.log('🔧 lab_referrals table does not exist — applying fix...');

    // Check if old "referrals" table exists
    const [referralsExists] = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'referrals'
      ) as exists`
    );

    if (referralsExists[0].exists) {
      console.log('📋 Renaming old "referrals" table to "referrals_old"...');
      await queryInterface.sequelize.query(
        `ALTER TABLE IF EXISTS referrals RENAME TO referrals_old`
      );
    }

    // Create lab_referrals table
    console.log('📋 Creating lab_referrals table...');
    await queryInterface.createTable('lab_referrals', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      referral_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      referring_institution_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'institutions', key: 'id' },
        onDelete: 'CASCADE'
      },
      receiving_institution_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'institutions', key: 'id' },
        onDelete: 'CASCADE'
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onDelete: 'CASCADE'
      },
      visit_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'visits', key: 'id' },
        onDelete: 'SET NULL'
      },
      requested_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'staffs', key: 'id' },
        onDelete: 'SET NULL'
      },
      department_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
        onDelete: 'SET NULL'
      },
      referral_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      status: {
        type: Sequelize.ENUM(
          'pending', 'sent', 'accepted', 'sample_collected',
          'processing', 'result_ready', 'result_received',
          'completed', 'rejected', 'cancelled'
        ),
        allowNull: false,
        defaultValue: 'pending'
      },
      clinical_reason: { type: Sequelize.TEXT, allowNull: true },
      clinical_notes: { type: Sequelize.TEXT, allowNull: true },
      expected_result_date: { type: Sequelize.DATE, allowNull: true },
      result_received_at: { type: Sequelize.DATE, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    // Create lab_referral_items table
    console.log('📋 Creating lab_referral_items table...');
    await queryInterface.createTable('lab_referral_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      referral_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'lab_referrals', key: 'id' },
        onDelete: 'CASCADE'
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'lab_test_templates', key: 'id' },
        onDelete: 'CASCADE'
      },
      request_notes: { type: Sequelize.TEXT, allowNull: true },
      result_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'lab_test_results', key: 'id' },
        onDelete: 'SET NULL'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    // Add referral_id to lab_test_results if it doesn't exist
    const [columns] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'lab_test_results' AND column_name = 'referral_id'`
    );

    if (columns.length === 0) {
      console.log('📋 Adding referral_id column to lab_test_results...');
      await queryInterface.addColumn('lab_test_results', 'referral_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'lab_referrals', key: 'id' },
        onDelete: 'SET NULL'
      });
    } else {
      console.log('✅ referral_id column already exists on lab_test_results');
    }

    // Add indexes
    console.log('📋 Adding indexes...');
    await queryInterface.addIndex('lab_referrals', ['referring_institution_id']);
    await queryInterface.addIndex('lab_referrals', ['receiving_institution_id']);
    await queryInterface.addIndex('lab_referrals', ['patient_id']);
    await queryInterface.addIndex('lab_referrals', ['visit_id']);
    await queryInterface.addIndex('lab_referrals', ['status']);

    console.log('✅ Fix migration completed successfully');
  },

  down: async (queryInterface) => {
    // Remove referral_id from lab_test_results
    const [columns] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'lab_test_results' AND column_name = 'referral_id'`
    );
    if (columns.length > 0) {
      await queryInterface.removeColumn('lab_test_results', 'referral_id');
    }

    // Drop tables
    await queryInterface.dropTable('lab_referral_items');
    await queryInterface.dropTable('lab_referrals');

    // Restore old table if it exists
    const [oldTableExists] = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'referrals_old'
      ) as exists`
    );
    if (oldTableExists[0].exists) {
      await queryInterface.sequelize.query(
        `ALTER TABLE referrals_old RENAME TO referrals`
      );
    }
  }
};
