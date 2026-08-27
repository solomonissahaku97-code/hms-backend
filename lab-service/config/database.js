require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'hms',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: false,
    pool: { max: 10, min: 0, idle: 10000, acquire: 30000 },
  }
);

sequelize.authenticate()
  .then(() => console.log(`[✓] Lab Service connected to database: ${process.env.DB_NAME || 'hms'}`))
  .catch((err) => console.error('❌ Lab Service database connection failed:', err.message));

module.exports = sequelize;
