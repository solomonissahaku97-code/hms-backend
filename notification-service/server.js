const express = require('express');
const cors = require('cors');
const config = require('./config/conf');
const { sequelize } = require('./config/database');
const routes = require('./routes');
const { initFirebase, isInitialized: isFirebaseInitialized } = require('./services/fcmService');

const app = express();

app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE,PATCH', credentials: false }));
app.use(express.json());

// ── Health Check ────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'OK',
      service: 'notification-service',
      version: '1.0.0',
      database: 'Connected',
      firebase: isFirebaseInitialized() ? 'Initialized (tonitel-hms)' : 'Not configured (no Firebase credentials)',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      service: 'notification-service',
      database: 'Disconnected',
      error: error.message,
    });
  }
});

// ── Routes ──────────────────────────────────────────────────────
app.use('/api/v1/notification', routes);

// ── Root ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'HMS Notification Service',
    version: '1.0.0',
    health: '/health',
  });
});

// ── Error Handler ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Notification Service] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ────────────────────────────────────────────────
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Notification Service database connected');

    initFirebase();

    app.listen(config.port, () => {
      console.log(`🔔 Notification Service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start notification service:', err);
    process.exit(1);
  }
};

start();

// ── Graceful Shutdown ───────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Notification Service shutting down...');
  await sequelize.close();
  process.exit(0);
});

module.exports = app;
