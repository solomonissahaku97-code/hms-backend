const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Authentication middleware for pharmacy service.
 * Accepts tokens from:
 * 1. Direct user JWT tokens
 * 2. Inter-service API key headers (X-Service-Key)
 */
function authenticateToken(req, res, next) {
  // Check for inter-service communication first
  const serviceKey = req.headers['x-service-key'];
  if (serviceKey && serviceKey === config.hmsBackendApiKey) {
    req.user = {
      id: req.headers['x-service-user-id'] || 'system',
      institution_id: req.headers['x-service-institution-id'],
      role: 'service',
    };
    return next();
  }

  // Standard JWT authentication
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid token:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Institution scope middleware.
 * Ensures the authenticated user can only access their institution's data.
 */
function requireInstitution(req, res, next) {
  const institutionId = req.query.institution_id || req.body.institution_id || req.params.institution_id;

  if (!institutionId) {
    return res.status(400).json({ error: 'institution_id is required' });
  }

  // Service accounts can access any institution
  if (req.user.role === 'service') {
    req.institutionId = institutionId;
    return next();
  }

  // Regular users must match their institution
  if (req.user.institution_id && req.user.institution_id !== institutionId) {
    return res.status(403).json({ error: 'Access denied: institution mismatch' });
  }

  req.institutionId = institutionId;
  next();
}

module.exports = { authenticateToken, requireInstitution };
