/**
 * Service Auth Middleware — validates X-Service-Key from gateway.
 */
const SERVICE_KEY = process.env.SERVICE_AUTH_SECRET || process.env.HMS_SERVICE_KEY || 'change-me-in-production';

function authenticateService(req, res, next) {
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey && serviceKey === SERVICE_KEY) {
    req.serviceUser = {
      id: req.headers['x-service-user-id'] || '',
      institution_id: req.headers['x-service-institution-id'] || '',
    };
    return next();
  }
  return res.status(401).json({ error: 'Invalid service key', success: false });
}

function authenticateToken(req, res, next) {
  // Accept service auth OR JWT token
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey && serviceKey === SERVICE_KEY) {
    req.user = {
      id: req.headers['x-service-user-id'] || '',
      institution_id: req.headers['x-service-institution-id'] || '',
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied', success: false });

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '8b3e0b4d6a2d9b5b7f3d7f1a4c6e8b9a0d2f4c6e8a1b3d5f7c9e1a3b5d7f9a1c2e4f6a8b0d2c4e6f8a1b3d5f7c9e1a');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token', success: false });
  }
}

module.exports = { authenticateService, authenticateToken };
