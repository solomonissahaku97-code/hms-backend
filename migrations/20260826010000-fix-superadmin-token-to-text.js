'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Change the superadmin.token column from VARCHAR(255) to TEXT
        // to accommodate JWT tokens which can exceed 255 characters
        await queryInterface.sequelize.query(`
            ALTER TABLE "superadmin" 
            ALTER COLUMN "token" TYPE TEXT;
        `);
        console.log('✅ Altered superadmin.token column from VARCHAR(255) to TEXT');
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.query(`
            ALTER TABLE "superadmin" 
            ALTER COLUMN "token" TYPE VARCHAR(255);
        `);
        console.log('↩️  Reverted superadmin.token column back to VARCHAR(255)');
    },
};
