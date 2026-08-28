require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3010'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  serviceKey: process.env.HMS_SERVICE_KEY || 'change-me-in-production',
};
