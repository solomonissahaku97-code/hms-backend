const jwt = require('jsonwebtoken');
const config = require('../config/conf');

const authenticate = (req, res, next) => {
  // If a Bearer token is present, verify the user's JWT first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], config.jwt.secret);
      return next();
    } catch (err) {
      // Token expired or invalid — try service key as fallback
    }
  }

  // If no valid user JWT, try the service key
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey && serviceKey === config.serviceKey) {
    req.user = { id: 'system', role: 'service' };
    return next();
  }

  return res.status(401).json({ error: 'Authentication required' });
};

module.exports = { authenticate };
