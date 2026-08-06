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

    dialectOptions:
      process.env.DB_SSL === 'true'
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : {},

    pool: {
      max: 10,
      min: 0,
      idle: 10000,
      acquire: 30000,
    },
  }
);

sequelize.authenticate()
  .then(() => {
    console.log(
      `[✓] Connected to database: ${process.env.DB_NAME || 'hms'}`
    );
  })
  .catch((error) => {
    console.error('❌ Unable to connect to the database:', error);
  });

module.exports = sequelize;