require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const basicAuth = require('express-basic-auth');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger/swagger-output.json');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('./models');
const sequelize = require('./config/database');
const { port } = require('./config/conf');
const NotificationService = require('./service/notificationService');

// Dynamically override swagger host and schemes so production doesn't show http
if (process.env.NODE_ENV === 'production' && process.env.APP_URL) {
  swaggerFile.host = process.env.APP_URL;
  swaggerFile.schemes = ['https'];
} else if (process.env.NODE_ENV !== 'production' && process.env.APP_URL_DEV) {
  swaggerFile.host = process.env.APP_URL_DEV;
  swaggerFile.schemes = ['http'];
}

// Initialize express app
const app = express();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates/views'));

// Enable CORS
app.use(cors({
  origin: '*',
  methods: 'GET,POST,PUT,DELETE,PATCH',
  credentials: false,
}));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Swagger setup with basic auth
app.use('/api-docs', basicAuth({
  users: { 'admin': 'pa$$w0rd' },
  challenge: true,
  unauthorizedResponse: (req) => 'Unauthorized Access',
}));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

/* -------------------------------------------------------------------------- */
/*                            Seeder Runner Function                          */
/* -------------------------------------------------------------------------- */
async function runAllSeeders() {
  console.log('🚀 Starting all seeders...');
  
  const seeders = [
    { name: 'createAccessControls', path: './default-scripts/createAccessControls' },
    { name: 'createRoles', path: './default-scripts/createRoles' },
    { name: 'testKits', path: './default-scripts/testKits' },
    { name: 'permissionsSeeds', path: './default-scripts/permissionsSeeds' },
    { name: 'seedRolePermissions', path: './default-scripts/seedRolePermissions' },
    { name: 'syncGDRG', path: './default-scripts/syncGDRG' },
    { name: 'seedSystemDiagnosis', path: './default-scripts/seedSystemDiagnosis' },
    { name: 'seedSystemSettings', path: './default-scripts/seedSystemSettings' },
    { name: 'syncMedicines', path: './default-scripts/syncMedicines' },
    { name: 'syncIcd10ToGdrg', path: './default-scripts/syncIcd10ToGdrg' },
    { name: 'syncLabRanges', path: './default-scripts/syncLabRanges' },
    { name: 'seedLabInvestigations', path: './default-scripts/seedLabInvestigations' },
    { name: 'seedLabTemplates', path: './default-scripts/seedLabTemplates' }
  ];

  let successful = 0;
  let failed = 0;

  for (const seeder of seeders) {
    try {
      console.log(`\n🌱 Running ${seeder.name}...`);
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
      failed++;
    } 
  }

  console.log(`\n🎉 Seeders Summary: ${successful} successful, ${failed} failed`);
  return { successful, failed };
}

/* -------------------------------------------------------------------------- */
/*                               CRON JOBS                                   */
/* -------------------------------------------------------------------------- */

// Generate a new QR code daily at 12 AM
cron.schedule("0 0 * * *", async () => {
  try {
    const { QrCode } = require('./models');
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await QrCode.create({ token, expiresAt });
    console.log("✅ New QR Code generated and stored in DB");
  } catch (error) {
    console.error("❌ Scheduled QR Code Generation Error:", error);
  }
});

// Clean up expired QR codes daily at 1 AM
cron.schedule("0 1 * * *", async () => {
  try {
    const { QrCode } = require('./models');
    await QrCode.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
    console.log("🧹 Expired QR Codes cleaned up");
  } catch (error) {
    console.error("❌ QR Code cleanup error:", error);
  }
});

/* -------------------------------------------------------------------------- */
/*                               ROUTES                                      */
/* -------------------------------------------------------------------------- */
const setupRoutes = require('./routes/index');
// const EducationMaterials = require('./models/theatre/EducationalMaterials');
// const PatientAllergies = require('./models/theatre/PatientAllergies');
setupRoutes(app);

// Test route
app.get('/', (req, res) => {
  res.send('Socket.IO server is running');
});

// Health check route
app.get('/health', async (req, res) => {
  try {
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

// Manual seeder trigger
app.post('/admin/run-seeders', async (req, res) => {
  try {
    console.log('🔄 Manual seeder trigger requested');
    const results = await runAllSeeders();
    res.json({ message: 'Seeders execution completed', results });
  } catch (error) {
    console.error('❌ Manual seeder execution failed:', error);
    res.status(500).json({ error: 'Seeder execution failed', message: error.message });
  }
});

/* -------------------------------------------------------------------------- */
/*                          SERVER + SOCKET.IO SETUP                         */
/* -------------------------------------------------------------------------- */

// Create HTTP + Socket.IO server properly
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Make Socket.IO available in app
app.set('ws', io);
app.use((req, res, next) => { req.io = io; next(); });

// Initialize Notification WebSocket service
const notificationService = new NotificationService(io);
app.set('notificationService', notificationService);

// Initialize Call Socket Handler for department calls
const CallSocketHandler = require('./service/callSocketHandler');
const callSocketHandler = new CallSocketHandler(io);

// Initialize ChatService for messaging
const ChatService = require('./service/ChatService');
const { alter } = require('./validators/validateInstitution');
const chatService = new ChatService(io);

// Start the server
server.listen(port, '0.0.0.0', async () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
  try {
    await runAllSeeders();
    console.log('✅ All startup processes completed successfully');
  } catch (error) {
    console.error('❀ Startup process completed with some errors, but server is running:', error.message);
  }
});

/* -------------------------------------------------------------------------- */
/*                          GRACEFUL SHUTDOWN                                */
/* -------------------------------------------------------------------------- */
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await db.sequelize.close();
    console.log('✅ Database connection closed');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

module.exports = app;
