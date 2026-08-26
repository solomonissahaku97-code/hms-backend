const jwt = require('jsonwebtoken');
const { jwtSecret, jwtRefreshSecret } = require('../config/conf');

const generateToken = (user, permissions = []) => {
    const payload = { 
        id: user.id,
        role_id: user.role_id || null,
        role_name: user.role_name || null,
        user_type: user.user_type || user.role_manager || null,
        permissions: permissions || [] 
    };
    return jwt.sign(payload, jwtSecret);
};

const generateRefreshToken = (user) => {
    return jwt.sign({ id: user.id }, jwtRefreshSecret, { expiresIn: '7d' });
};

module.exports = {
    generateToken,
    generateRefreshToken
};
