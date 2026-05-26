const { sequelize } = require('../config/database');
const createAccessControls = require('./createAccessControls');
const createRoles = require('./createRoles');

async function initializeDatabase() {
  try {
    // Sync database
    await sequelize.sync();

    // Seed access controls
    await createAccessControls();

    // Seed roles
    await createRoles();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

module.exports = initializeDatabase;
