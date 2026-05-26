const jwt = require('jsonwebtoken'); // Import JWT for token verification
const { Admin, Staff } = require('../models'); // Import Admin and Staff models

const eitherAuthOrAdmin = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if the token belongs to an Admin
    const admin = await Admin.findByPk(decoded.id);
    if (admin) {
      req.admin = admin;
      return next();
    }

    // Check if the token belongs to a Staff and is not expired
    const staff = await Staff.findByPk(decoded.id);

    // console.log(staff,token)
    if (staff) {
      req.user = staff;
      return next();
    }


    // If neither Admin nor Staff is found
    return res.status(403).json({ message: 'Not authorized as admin or staff' });
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

module.exports = eitherAuthOrAdmin;