'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
      // Step 1: Temporarily drop any existing foreign key constraint (if present)
      await queryInterface.removeConstraint('inventory_records', 'inventory_records_issued_by_fkey')
          .catch(() => console.log("No previous foreign key constraint found"));

      // Step 2: Convert issued_by (string) to UUID format where valid
      await queryInterface.sequelize.query(`
          ALTER TABLE inventory_records 
          ALTER COLUMN issued_by TYPE UUID USING issued_by::UUID;
      `);

      // Step 3: Add foreign key constraint to reference `staff` table
      await queryInterface.addConstraint('inventory_records', {
          fields: ['issued_by'],
          type: 'foreign key',
          name: 'inventory_records_issued_by_fkey',
          references: {
              table: 'staffs',
              field: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
      });
  },

  async down(queryInterface, Sequelize) {
      // Rollback: Remove foreign key constraint first
      await queryInterface.removeConstraint('inventory_records', 'inventory_records_issued_by_fkey');

      // Convert issued_by back to STRING
      await queryInterface.sequelize.query(`
          ALTER TABLE inventory_records 
          ALTER COLUMN issued_by TYPE VARCHAR(255);
      `);
  }
};
