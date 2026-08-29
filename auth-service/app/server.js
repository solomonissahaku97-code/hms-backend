require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { port, nodeEnv } = require('./config/conf');
const sequelize = require('./config/database');
const routes = require('./routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE,PATCH' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount routes at /api/v1/auth
app.use('/api/v1/auth', routes);

// Root health check (for Docker HEALTHCHECK)
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.originalUrl }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Auth Service on http://localhost:${port}`);
      console.log(`📋 Environment: ${nodeEnv}`);
    });
  } catch (err) {
    console.error('❌ Failed to start:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => { await sequelize.close(); process.exit(0); });
process.on('SIGTERM', async () => { await sequelize.close(); process.exit(0); });

start();
module.exports = app;
