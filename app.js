require('dotenv').config();
const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger/swagger-output.json');
const basicAuth = require('express-basic-auth');

// Initialize express app
const app = express();

// Middleware
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates/views'));

app.use(cors({
  origin: '*',
  methods: 'GET,POST,PUT,DELETE,PATCH',
  credentials: false,
}));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Swagger setup
app.use('/api-docs', basicAuth({
  users: { 'tonitel': 'pa$$word123' },
  challenge: true,
  unauthorizedResponse: (req) => 'Unauthorized Access',
}));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Seeder Runner Function
async function runAllSeeders() {
  console.log('🚀 Starting all seeders...');
  
  const seeders = [
    { name: 'createAccessControls', path: './default-scripts/createAccessControls' },
    { name: 'createRoles', path: './default-scripts/createRoles' },
    { name: 'testKits', path: './default-scripts/testKits' },
    { name: 'permissionsSeeds', path: './default-scripts/permissionsSeeds' },
    { name: 'syncGDRG', path: './default-scripts/syncGDRG' },
    { name: 'seedSystemDiagnosis', path: './default-scripts/seedSystemDiagnosis' },
    { name: 'syncMedicines', path: './default-scripts/syncMedicines' },
    { name: 'syncIcd10ToGdrg', path: './default-scripts/syncIcd10ToGdrg' },
    { name: 'syncLabRanges', path: './default-scripts/syncLabRanges' },
    { name: 'seedLabTemplates', path: './default-scripts/seedLabTemplates' }
  ];

  let successful = 0;
  let failed = 0;

  for (const seeder of seeders) {
    try {
      console.log(`\n🌱 Running ${seeder.name}...`);
      
      // Check if seeder file exists
      const fs = require('fs');
      const fullPath = require('path').resolve(__dirname, seeder.path + '.js');
      
      if (!fs.existsSync(fullPath)) {
        console.log(`❌ Seeder file not found: ${seeder.path}`);
        failed++;
        continue;
      }

      const seederFunction = require(seeder.path);
      
      if (typeof seederFunction !== 'function') {
        console.log(`❌ ${seeder.name} is not a function`);
        failed++;
        continue;
      }

      await seederFunction();
      console.log(`✅ ${seeder.name} completed successfully`);
      successful++;
      
    } catch (error) {
      console.error(`💥 Failed to run ${seeder.name}:`, error.message);
      console.error(error.stack);
      failed++;
    }
  }

  console.log(`\n🎉 Seeders Summary: ${successful} successful, ${failed} failed`);
  return { successful, failed };
}

// Routes setup
const setupRoutes = require('./routes/index');
setupRoutes(app);

// Test route
app.get('/', (req, res) => {
  res.send('Socket.IO server is running');
});

// Health check route with seeder status
app.get('/health', async (req, res) => {
  try {
    const db = require('./models');
    await db.sequelize.authenticate();
    res.json({ 
      status: 'OK', 
      database: 'Connected',
      message: 'Server is running normally'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'Error', 
      database: 'Disconnected',
      error: error.message 
    });
  }
});

// Manual seeder trigger route (optional - for admin use)
app.post('/admin/run-seeders', async (req, res) => {
  try {
    console.log('🔄 Manual seeder trigger requested');
    const results = await runAllSeeders();
    
    res.json({
      message: 'Seeders execution completed',
      results: results
    });
  } catch (error) {
    console.error('❌ Manual seeder execution failed:', error);
    res.status(500).json({
      error: 'Seeder execution failed',
      message: error.message
    });
  }
});

// Make runAllSeeders available for server.js
app.runAllSeeders = runAllSeeders;

module.exports = app;