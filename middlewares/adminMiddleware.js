const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

const verifyAdminToken = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return next(null); // No token, let eitherAuthOrAdmin handle it
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findByPk(decoded.id);

    if (!admin) {
      return next(null); // Not an admin, but let eitherAuthOrAdmin handle it
    }

    req.admin = admin;
    return next();
  } catch (error) {
    return next(null); // Invalid token, but let eitherAuthOrAdmin handle it
  }
};

module.exports = verifyAdminToken;
