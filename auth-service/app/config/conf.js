require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3008,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  serviceAuthKey: process.env.SERVICE_AUTH_KEY || process.env.HMS_SERVICE_KEY || '',
};
