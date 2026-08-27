require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  hmsBackendUrl: process.env.HMS_BACKEND_URL || 'http://localhost:3000',
  hmsBackendApiKey: process.env.HMS_BACKEND_API_KEY || '',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
