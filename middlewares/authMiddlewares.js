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
    const user = await Staff.findByPk(decoded.id);

    if (!user || user.token_expiration < new Date()) {
      return next(null); // Invalid token, but don't send response, let eitherAuthOrAdmin handle it
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(null); // Invalid token, but let eitherAuthOrAdmin handle it
  }
};

module.exports = authenticateToken;
