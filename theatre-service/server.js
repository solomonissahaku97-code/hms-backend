const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/conf');
const { sequelize } = require('./models');
const routes = require('./routes');

const app = express();

// ── Middleware ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// ── Health Check ────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'OK', service: 'theatre-service', version: '1.0.0', database: 'Connected' });
  } catch (err) {
    res.status(503).json({ status: 'ERROR', service: 'theatre-service', database: 'Disconnected', error: err.message });
  }
});

// ── API Routes ──────────────────────────────────────────────────
app.use('/api/v1/theatre', routes);

// ── 404 ─────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error Handler ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────────
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    await sequelize.sync({ alter: true });
    console.log('✅ Models synchronized');

    app.listen(config.port, () => {
      console.log(`🏥 Theatre Service running on port ${config.port}`);
      console.log(`📋 Docs: http://localhost:${config.port}/health`);
    });
  } catch (err) {
    console.error('❌ Failed to start theatre service:', err);
    process.exit(1);
  }
};

start();
