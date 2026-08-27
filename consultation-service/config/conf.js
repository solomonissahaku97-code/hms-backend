require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3006,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'hms',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
  },
  jwt: { secret: process.env.JWT_SECRET || 'change-me' },
  serviceKey: process.env.HMS_SERVICE_KEY || 'dev-service-key',
  hmsBackendUrl: process.env.HMS_BACKEND_URL || 'http://backend:5008',
};
