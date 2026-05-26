const jwt = require('jsonwebtoken');
const { jwtSecret,jwtRefreshSecret } = require('../config/conf');

const generateToken = (user) => {
    return jwt.sign({ id: user.id }, jwtSecret,);
};

const generateRefreshToken = (user) => {
    return jwt.sign({ id: user.id }, jwtRefreshSecret, { expiresIn: '7d' });
};

module.exports = {
    generateToken,
    generateRefreshToken
};
