const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/conf');
const { Staff, Admin, SuperAdmin } = require('../models');

let clients = [];

const authenticateHandler = async (ws, messageData) => {
  const { token, userId, institution_id } = messageData;

  if (!token) {
    ws.send(JSON.stringify({ event: 'error', message: 'Authentication token required' }));
    return null;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    
    // Try to find user by ID across all user types
    let currentUser = await Staff.findByPk(decoded.id);
    let userType = 'staff';
    
    if (!currentUser) {
      currentUser = await Admin.findByPk(decoded.id);
      userType = 'admin';
    }
    
    if (!currentUser) {
      currentUser = await SuperAdmin.findByPk(decoded.id);
      userType = 'superadmin';
    }

    if (!currentUser) {
      ws.send(JSON.stringify({ event: 'error', message: 'Invalid authentication token' }));
      return null;
    }

    // Get permissions from JWT
    const permissions = decoded.permissions || [];
    const role_name = decoded.role_name || userType;

    const currentUserData = { 
      socket: ws, 
      userId: currentUser.id, 
      institution_id: institution_id || currentUser.institution_id,
      role: { name: role_name },
      permissions: permissions,
      userType: userType
    };
    
    clients.push(currentUserData);

    ws.send(JSON.stringify({ event: 'authenticated', message: 'Authentication successful' }));
    return currentUserData;
  } catch (err) {
    ws.send(JSON.stringify({ event: 'error', message: 'Invalid authentication token' }));
    return null;
  }
};

module.exports = { authenticateHandler, clients };
