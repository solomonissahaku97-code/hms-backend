/**
 * HMS WebSocket Service — Entry Point
 *
 * Centralized real-time communication hub for all HMS microservices.
 * Handles: notifications, chat, calls, lab alerts, status updates.
 *
 * Clients connect via WebSocket (Socket.IO).
 * Microservices emit events via REST API.
 */

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('ioredis');

const { port, redisUrl } = require('./config/conf');
const { authenticateSocket } = require('./middleware/auth');
const HMSSocketService = require('./services/socketService');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

// ── Middleware ──────────────────────────────────────────────────
app.use(express.json());
app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE,PATCH', credentials: false }));

// ── Socket.IO Setup ────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Redis Adapter (for horizontal scaling) ─────────────────────
async function setupRedis() {
  try {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Redis adapter connected — multi-instance support enabled');
  } catch (error) {
    console.warn('⚠️  Redis not available — running in single-instance mode:', error.message);
    console.warn('   WebSocket will work but only on this single instance.');
  }
}

// ── Initialize Socket Service ──────────────────────────────────
const hmsSocketService = new HMSSocketService(io);
app.locals.hmsSocketService = hmsSocketService;

// ── Authentication ─────────────────────────────────────────────
io.use(authenticateSocket);

// ── REST API Routes ────────────────────────────────────────────
app.use('/api/v1/ws', apiRoutes);

// ── Health Check ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'websocket-service',
    version: '1.0.0',
    connections: hmsSocketService.getStats(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/ready', (req, res) => {
  res.json({ status: 'ready' });
});

// ── Root ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'HMS WebSocket Service',
    version: '1.0.0',
    health: '/health',
    api: '/api/v1/ws',
    stats: '/api/v1/ws/stats',
  });
});

// ── Start Server ───────────────────────────────────────────────
server.listen(port, '0.0.0.0', async () => {
  console.log(`🔔 WebSocket Service running on http://localhost:${port}`);
  console.log(`   WebSocket: ws://localhost:${port}`);
  console.log(`   REST API:  http://localhost:${port}/api/v1/ws`);
  await setupRedis();
});

// ── Graceful Shutdown ──────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 WebSocket Service shutting down...');
  io.close();
  process.exit(0);
});

module.exports = { app, server, io };
