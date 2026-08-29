const jwt = require('jsonwebtoken');
const config = require('../config/conf');

function authenticateToken(req, res, next) {
  // Service-to-service auth
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey && serviceKey === config.serviceAuthKey) {
    req.user = {
      id: req.headers['x-service-user-id'] || 'system',
      institution_id: req.headers['x-service-institution-id'],
      role: 'service',
    };
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateToken };
