const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/conf');
const { Staff, Admin, User } = require('../models');

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

    // ── PATH A: Try unified users table first ──────────────
    try {
      const unifiedUser = await User.findByPk(decoded.id);
      if (unifiedUser) {
        req.user = unifiedUser;
        req.userType = unifiedUser.user_type;

        if (unifiedUser.user_type === 'STAFF') {
          req.staffId = unifiedUser.id;
        } else if (unifiedUser.user_type === 'ADMIN') {
          req.admin = unifiedUser;
        } else if (unifiedUser.user_type === 'SUPER_ADMIN') {
          req.superAdmin = unifiedUser;
        }
        return next();
      }
    } catch (e) {
      // users table may not exist yet — fall through
    }

    // ── PATH B: Legacy fallback ────────────────────────────
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
