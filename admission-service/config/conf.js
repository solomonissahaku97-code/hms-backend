require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3003,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  hmsBackendUrl: process.env.HMS_BACKEND_URL || 'http://localhost:5008',
  hmsServiceKey: process.env.HMS_SERVICE_KEY || 'dev-service-key',
};
