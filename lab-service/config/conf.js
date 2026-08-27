require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  port: process.env.PORT || 5012,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  serviceAuthSecret: process.env.SERVICE_AUTH_SECRET || 'change-me',
  notificationsServiceUrl: process.env.NOTIFICATIONS_SERVICE_URL || 'http://notifications-service:8000',
  notificationsServiceSecret: process.env.NOTIFICATIONS_SERVICE_SECRET || 'change-me',
};
