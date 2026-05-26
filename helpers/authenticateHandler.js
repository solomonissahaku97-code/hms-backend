let clients = [];

const authenticateHandler = (ws, messageData) => {
  const { role, userId,institution_id } = messageData;

  const currentUser = { socket: ws, role, userId,institution_id };
  clients.push(currentUser);

  ws.send(JSON.stringify({ event: 'authenticated', message: 'Authentication successful' }));
  return currentUser;
};

module.exports = { authenticateHandler, clients };
