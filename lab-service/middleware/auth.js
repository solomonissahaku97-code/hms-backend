/**
 * Lab Service — Auth Middleware
 *
 * Handles two auth patterns:
 * 1. Service-to-service: HMAC-signed requests from HMS backend
 * 2. JWT: User tokens passed through from the monolith
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret, serviceAuthSecret } = require('../config/conf');

const MAX_REQUEST_AGE = 300; // 5 minutes for service-to-service

/**
 * Verify service-to-service HMAC signature.
 * Used when the monolith calls the lab service internally.
 */
const verifyServiceAuth = (req, res, next) => {
  const authHeader = req.headers['x-service-auth'];
  const serviceName = req.headers['x-service-name'];
  const timestampStr = req.headers['x-timestamp'];

  // If no service auth headers, fall through to JWT check
  if (!authHeader || !serviceName || !timestampStr) {
    return next();
  }

  // Verify timestamp
  try {
    const timestamp = parseInt(timestampStr);
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
    if (age > MAX_REQUEST_AGE) {
      return res.status(401).json({ success: false, message: 'Request timestamp too old' });
    }
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid timestamp' });
  }

  // Verify HMAC
  const expectedMessage = `${serviceName}:${timestampStr}`;
  const expectedSignature = crypto
    .createHmac('sha256', serviceAuthSecret)
    .update(expectedMessage)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedSignature))) {
    return res.status(401).json({ success: false, message: 'Invalid service authentication' });
  }

  // Attach service identity
  req.authMethod = 'service';
  req.serviceName = serviceName;
  return next();
};

/**
 * Verify JWT token from user requests.
 * Extracts user claims without hitting the database (lightweight).
 */
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);

    req.user = decoded;
    req.userId = decoded.id;
    req.roleId = decoded.role_id || null;
    req.permissions = decoded.permissions || [];

    // Legacy field mapping
    if (decoded.user_type === 'STAFF') {
      req.staffId = decoded.id;
    } else if (decoded.user_type === 'ADMIN') {
      req.admin = { id: decoded.id, institution_id: decoded.institution_id };
    } else if (decoded.user_type === 'SUPER_ADMIN') {
      req.superAdmin = { id: decoded.id };
      req.permissions = ['*'];
    }

    req.authMethod = 'jwt';
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ success: false, message: 'Token has expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    return res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

/**
 * Combined auth: tries service auth first, then JWT.
 * This allows both internal service calls and user-facing requests.
 */
const authenticate = (req, res, next) => {
  // Check for service auth first
  const authHeader = req.headers['x-service-auth'];
  if (authHeader) {
    return verifyServiceAuth(req, res, next);
  }
  // Otherwise, verify JWT
  return verifyJWT(req, res, next);
};

module.exports = { authenticate, verifyServiceAuth, verifyJWT };
