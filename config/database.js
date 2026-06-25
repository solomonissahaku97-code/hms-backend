require('dotenv').config();

const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.NODE_ENV === 'production') {
    sequelize = new Sequelize(
  'postgres', // database
  'postgres.bbgliscmybmrbfuybtyv', // user (IMPORTANT: full user with project ref)
  'lilnastic205', // your actual Supabase password
  {
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    port: 5432,
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: {
      max: 5,
      min: 0,
      idle: 10000,
      acquire: 30000,
    },
  }
);
} else {
    sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_LOCAL_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      dialect: process.env.DB_DIALECT || 'postgres',
      logging: false,
    }
  );

}

// Test connection
sequelize.authenticate()
  .then(() => {
    console.log(`[✓] Connected to the ${process.env.NODE_ENV === 'production' ? 'production' : 'local'} database.`);
  })
  .catch((error) => {
    console.error('❌ Unable to connect to the database:', error);
  });

module.exports = sequelize; 