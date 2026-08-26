const jwt = require('jsonwebtoken');
const { Admin, User } = require('../models');

const verifyAdminToken = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return next(null);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try legacy Admin table first
    let admin = await Admin.findByPk(decoded.id);

    // If not found in admins table, try unified users table (for ADMIN type)
    if (!admin && decoded.id) {
      const unifiedUser = await User.findByPk(decoded.id);
      if (unifiedUser && unifiedUser.user_type === 'ADMIN') {
        // Create a compatible admin-like object from the unified user
        admin = {
          id: unifiedUser.id,
          username: unifiedUser.username || unifiedUser.first_name,
          email: unifiedUser.email,
          institution_id: unifiedUser.institution_id,
          // Mock the findByPk shape so req.admin works downstream
          toJSON() { return this; }
        };
      }
    }

    if (!admin) {
      return next(null);
    }

    req.admin = admin;
    return next();
  } catch (error) {
    return next(null);
  }
};

module.exports = verifyAdminToken;
