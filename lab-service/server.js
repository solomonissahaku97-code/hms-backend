/**
 * HMS Lab Service — Entry Point
 *
 * Runs independently with its own Express server.
 * Handles lab tests, results, templates, ranges, investigations,
 * and result sharing.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./models');
const { port } = require('./config/conf');
const labRoutes = require('./routes/labRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────
app.use(express.json());
app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE,PATCH', credentials: false }));

// ── Health Check ───────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    res.json({
      status: 'OK',
      service: 'lab-service',
      database: 'Connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      service: 'lab-service',
      database: 'Disconnected',
      error: error.message,
    });
  }
});

app.get('/health/ready', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    res.json({ status: 'ready' });
  } catch (e) {
    res.status(503).json({ status: 'not ready' });
  }
});

// ── Routes ─────────────────────────────────────────────────────────
app.use('/api/v1/lab', labRoutes);

// ── Root ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'HMS Lab Service',
    version: '1.0.0',
    docs: '/docs',
    health: '/health',
  });
});

// ── Error Handler ──────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────────────
app.listen(port, '0.0.0.0', async () => {
  console.log(`🔬 Lab Service running on http://localhost:${port}`);
  try {
    await db.sequelize.authenticate();
    console.log('✅ Lab Service database connected');
  } catch (error) {
    console.error('❌ Lab Service database connection failed:', error.message);
  }
});

// ── Graceful Shutdown ──────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Lab Service shutting down...');
  await db.sequelize.close();
  process.exit(0);
});

module.exports = app;
