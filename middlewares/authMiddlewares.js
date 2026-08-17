const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/conf');
const { Staff, Admin } = require('../models');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader ? authHeader.split(' ').pop() : null;

  if (!token) {
    return next(null);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    
    req.role_id = decoded.role_id || null;
    req.role_name = decoded.role_name || null;
    req.permissions = decoded.permissions || [];
    
    const user = await Staff.findByPk(decoded.id);

    if (user && (!user.token_expiration || user.token_expiration >= new Date())) {
      req.user = user;
      req.staffId = user.id;
      return next();
    }

    const admin = await Admin.findByPk(decoded.id);

    if (admin) {
      req.user = admin;
      req.admin = admin;
      req.permissions = req.permissions.length > 0 ? req.permissions : ['*'];
      return next();
    }

    return next(null);
  } catch (err) {
    return next(null);
  }
};

module.exports = authenticateToken;
