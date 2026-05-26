const CallService = require('./callService');
const ChatService = require('./ChatService'); // Add this line

module.exports = function setupWebSocket(server) {
  const io = require('socket.io')(server, {
    cors: {
      origin: [
      '*'
      ],
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type'],
      transports: ['websocket', 'polling']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Initialize services
  const callService = new CallService(io);
  const chatService = new ChatService(io); // Add this line

  // Connection logging remains the same
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  console.log('WebSocket server initialized with chat support');
  return io;
};