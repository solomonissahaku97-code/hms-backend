'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1️⃣ Drop the existing "category" column
    await queryInterface.removeColumn("nhiaTariffs", "category");

    // 2️⃣ Create ENUM Type for "category" if it doesn’t exist
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_nhiaTariffs_category') THEN
              CREATE TYPE "public"."enum_nhiaTariffs_category" AS ENUM ('Procedure', 'Medicine', 'ICD', 'Investigation');
          END IF;
      END $$;
    `);

    // 3️⃣ Add back the "category" column with ENUM type
    await queryInterface.addColumn("nhiaTariffs", "category", {
      type: Sequelize.ENUM("Procedure", "Medicine", "ICD", "Investigation"),
      allowNull: false,
      defaultValue: "Medicine", // You can remove this default if needed
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back by removing column first
    await queryInterface.removeColumn("nhiaTariffs", "category");

    // Drop ENUM Type
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "public"."enum_nhiaTariffs_category";
    `);

    // Add back as STRING type (if needed)
    await queryInterface.addColumn("nhiaTariffs", "category", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
};
