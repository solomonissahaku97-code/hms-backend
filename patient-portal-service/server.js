const express = require('express');
const cors = require('cors');
const config = require('./config/conf');
const { sequelize } = require('./config/database');
const routes = require('./routes');

const app = express();

app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE,PATCH', credentials: false }));
app.use(express.json());

// ── Health Check ────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'OK',
      service: 'patient-portal-service',
      version: '1.0.0',
      database: 'Connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      service: 'patient-portal-service',
      database: 'Disconnected',
      error: error.message,
    });
  }
});

// ── Routes ──────────────────────────────────────────────────
app.use('/api/v1/patient', routes);

// ── Root ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'HMS Patient Portal Service',
    version: '1.0.0',
    health: '/health',
  });
});

// ── Error Handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Patient Portal Service] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ────────────────────────────────────────────
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Patient Portal Service database connected');

    app.listen(config.port, () => {
      console.log(`🏥 Patient Portal Service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start patient portal service:', err);
    process.exit(1);
  }
};

start();

// ── Graceful Shutdown ───────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Patient Portal Service shutting down...');
  await sequelize.close();
  process.exit(0);
});

module.exports = app;
