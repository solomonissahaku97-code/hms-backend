const jwt = require('jsonwebtoken');
const config = require('../config/conf');

const authenticate = (req, res, next) => {
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey && serviceKey === config.serviceKey) {
    req.user = { id: 'system', role: 'service' };
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], config.jwt.secret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
