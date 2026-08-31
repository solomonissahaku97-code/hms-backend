const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const sequelize = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3011;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/v1/network/health', (req, res) => {
  res.json({ status: 'ok', service: 'network-service', timestamp: new Date().toISOString() });
});

// Routes
const networkRoutes = require('./routes');
app.use('/api/v1/network', networkRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start
async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Network Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

start();
