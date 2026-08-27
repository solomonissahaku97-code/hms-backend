const jwt = require('jsonwebtoken');
const { jwtSecret, hmsServiceKey } = require('../config/conf');

function authenticateToken(req, res, next) {
  // Check service key first
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey && serviceKey === hmsServiceKey) {
    req.isServiceCall = true;
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateToken };
