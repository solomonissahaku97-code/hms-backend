const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/conf');
const { sequelize } = require('./models');
const routes = require('./routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'OK', service: 'consultation-service', version: '1.0.0', database: 'Connected' });
  } catch (err) {
    res.status(503).json({ status: 'ERROR', service: 'consultation-service', database: 'Disconnected', error: err.message });
  }
});

app.use('/api/v1/consultation', routes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error('Unhandled error:', err); res.status(500).json({ error: 'Internal server error' }); });

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    try { await sequelize.sync({ alter: false }); } catch(e) { console.log('Sync skipped (tables already exist):', e.message); }
    console.log('✅ Models synchronized');

    app.listen(config.port, () => {
      console.log(`🩺 Consultation Service running on port ${config.port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start consultation service:', err);
    process.exit(1);
  }
};

start();
