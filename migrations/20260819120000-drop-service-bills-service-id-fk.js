'use strict';

/**
 * FIX: Drop foreign key constraint on service_bills.service_id
 *
 * PROBLEM:
 *   The service_bills table has a PostgreSQL foreign key constraint
 *   "service_bills_service_id_fkey" that references services(id).
 *
 *   But service_id is POLYMORPHIC — it references different tables
 *   depending on service_type:
 *     - 'LabTest'    → lab_test_results.id
 *     - 'Medication' → prescriptions.id
 *     - 'Procedure'  → procedures.id
 *     - 'Service'    → services.id
 *     - 'Other'      → services.id
 *     - 'Consultation' → consultations.id
 *
 *   A single FK constraint cannot work for this pattern.
 *
 * SOLUTION:
 *   Drop the FK constraint. The application code (billingUtil.js)
 *   already validates the service_id exists in the correct table
 *   based on service_type before creating the ServiceBill.
 *
 * This migration is idempotent — safe to run multiple times.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Find and drop the foreign key constraint on service_bills.service_id
    const [constraints] = await queryInterface.sequelize.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'service_bills'::regclass
        AND conname LIKE '%service_id%'
        AND contype = 'f'
    `);

    if (constraints.length > 0) {
      for (const constraint of constraints) {
        console.log(`📋 Dropping FK constraint: ${constraint.conname}`);
        await queryInterface.sequelize.query(`
          ALTER TABLE service_bills DROP CONSTRAINT IF EXISTS "${constraint.conname}"
        `);
      }
      console.log('✅ Foreign key constraint on service_bills.service_id dropped');
    } else {
      console.log('ℹ️  No foreign key constraint found on service_bills.service_id — skipping');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Re-add the FK constraint (only if services table exists)
    const [servicesExists] = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'services'
      ) as exists`
    );

    if (servicesExists[0].exists) {
      console.log('📋 Re-adding FK constraint on service_bills.service_id');
      await queryInterface.sequelize.query(`
        ALTER TABLE service_bills
        ADD CONSTRAINT service_bills_service_id_fkey
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
      `);
    }
  }
};
