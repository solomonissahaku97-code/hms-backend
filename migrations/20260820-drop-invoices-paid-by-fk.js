/**
 * Migration: Drop the FK constraint on invoices.paid_by so it can store
 * either staff or admin UUIDs. The column stays as a plain UUID field.
 */
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the foreign key constraint if it exists
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE invoices 
        DROP CONSTRAINT IF EXISTS invoices_paid_by_fkey;
      `);
      console.log('✅ Dropped invoices.paid_by FK constraint');
    } catch (err) {
      console.log('⚠️  Could not drop FK constraint (may not exist):', err.message);
    }

    // Also drop any index on paid_by if it was auto-created
    try {
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS invoices_paid_by;
      `);
      console.log('✅ Dropped invoices.paid_by index');
    } catch (err) {
      // ignore
    }
  },

  async down(queryInterface, Sequelize) {
    // Re-add the FK constraint pointing to staffs
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE invoices 
        ADD CONSTRAINT invoices_paid_by_fkey 
        FOREIGN KEY (paid_by) REFERENCES staffs(id);
      `);
      console.log('✅ Re-added invoices.paid_by FK constraint');
    } catch (err) {
      console.log('⚠️  Could not re-add FK constraint:', err.message);
    }
  }
};
