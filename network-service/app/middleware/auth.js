const SERVICE_KEY = process.env.HMS_SERVICE_KEY || process.env.SERVICE_AUTH_SECRET || '';

function authenticateService(req, res, next) {
  const authHeader = req.headers.authorization;
  const serviceKey = req.headers['x-service-key'];

  // Service-to-service auth
  if (serviceKey && serviceKey === SERVICE_KEY) {
    req.user = {
      id: req.headers['x-service-user-id'] || null,
      institution_id: req.headers['x-service-institution-id'] || null,
    };
    return next();
  }

  // User token auth (passed through from gateway)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Gateway already validated the token — trust the forwarded headers
    req.user = {
      id: req.headers['x-service-user-id'] || null,
      institution_id: req.headers['x-service-institution-id'] || null,
    };
    return next();
  }

  return res.status(401).json({ success: false, message: 'Authentication required' });
}

module.exports = { authenticateService };
