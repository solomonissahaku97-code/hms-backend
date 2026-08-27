require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./models');
const { port } = require('./config/conf');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    res.json({ status: 'OK', service: 'admission-service', database: 'Connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'Error', service: 'admission-service', error: error.message });
  }
});

// API routes
app.use('/api/v1/admission', routes);

// Root
app.get('/', (req, res) => {
  res.json({ service: 'HMS Admission Service', version: '1.0.0', health: '/health' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Start
app.listen(port, '0.0.0.0', async () => {
  console.log(`🏥 Admission Service running on http://localhost:${port}`);
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connected');
    if (process.env.NODE_ENV === 'development') {
      await db.sequelize.sync({ alter: true });
      console.log('✅ Models synchronized');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
});

module.exports = app;
