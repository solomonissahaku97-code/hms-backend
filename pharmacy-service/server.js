require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { port, nodeEnv } = require('./config/conf');
const { sequelize } = require('./models');
const setupRoutes = require('./routes');
const logger = require('./utils/logger');

const app = express();

// ─── Security & Parsing ──────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE,PATCH' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'OK',
      service: 'pharmacy-service',
      database: 'Connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      service: 'pharmacy-service',
      database: 'Disconnected',
      error: error.message,
    });
  }
});

// ─── Service Info ────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'pharmacy-service',
    version: '1.0.0',
    description: 'Pharmacy microservice for HMS',
    docs: '/api-docs',
  });
});

// ─── Routes ──────────────────────────────────────────────────────
setupRoutes(app);

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// ─── Error Handler ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ────────────────────────────────────────────────
async function start() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('✅ Database connected successfully');

    // Sync models (use migrations in production)
    if (nodeEnv === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('✅ Models synchronized');
    }

    app.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Pharmacy Service running on http://localhost:${port}`);
      logger.info(`📋 Environment: ${nodeEnv}`);
      logger.info(`💊 API Base: /api/v1/pharmacy`);
    });
  } catch (error) {
    logger.error('❌ Failed to start pharmacy service:', error);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────
process.on('SIGINT', async () => {
  logger.info('\n🛑 Shutting down pharmacy service...');
  await sequelize.close();
  logger.info('✅ Database connection closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('\n🛑 Shutting down pharmacy service...');
  await sequelize.close();
  process.exit(0);
});

start();

module.exports = app;
