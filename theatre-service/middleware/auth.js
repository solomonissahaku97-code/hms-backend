const jwt = require('jsonwebtoken');
const config = require('../config/conf');

// JWT + Service Key authentication
const authenticate = (req, res, next) => {
  // Service-to-service auth
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey && serviceKey === config.serviceKey) {
    req.user = { id: 'system', role: 'service' };
    return next();
  }

  // JWT auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
