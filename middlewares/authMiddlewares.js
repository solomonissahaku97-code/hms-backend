const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/conf');
const { Staff } = require('../models');

const authenticateToken = async (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return next(null); // No token, but don't send response, let eitherAuthOrAdmin handle it
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    
    // Attach JWT claims to request for permission checks
    req.role_id = decoded.role_id || null;
    req.role_name = decoded.role_name || null;
    req.permissions = decoded.permissions || [];
    
    const user = await Staff.findByPk(decoded.id);

    if (!user || user.token_expiration < new Date()) {
      return next(null); // Invalid token, but don't send response, let eitherAuthOrAdmin handle it
    }

    req.user = user;
    req.staffId = user.id;
    return next();
  } catch (err) {
    return next(null); // Invalid token, but let eitherAuthOrAdmin handle it
  }
};

module.exports = authenticateToken;
