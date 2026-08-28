const jwt = require('jsonwebtoken');
const { jwtSecret, serviceKey } = require('../config/conf');

/**
 * Authenticate Socket.IO connection via token in handshake.auth
 */
function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;
  const xServiceKey = socket.handshake.auth?.serviceKey || socket.handshake.headers?.['x-service-key'];

  // Service-to-service auth
  if (xServiceKey && xServiceKey === serviceKey) {
    socket.data.user = { id: 'system', role: 'service' };
    return next();
  }

  // JWT user auth
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    socket.data.user = decoded;
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
}

/**
 * Authenticate REST API requests via Bearer token or X-Service-Key
 */
function authenticateRest(req, res, next) {
  const xServiceKey = req.headers['x-service-key'];
  if (xServiceKey && xServiceKey === serviceKey) {
    req.user = { id: 'system', role: 'service' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(authHeader.split(' ')[1], jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateSocket, authenticateRest };
