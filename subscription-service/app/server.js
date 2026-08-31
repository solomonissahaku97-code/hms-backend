require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3009;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/subscriptions', routes);

// Root
app.get('/', (req, res) => {
  res.json({ service: 'subscription-service', version: '1.0.0', port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Subscription Service] Running on port ${PORT}`);
});
