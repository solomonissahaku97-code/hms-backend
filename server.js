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
const { loadModels } = require("./utils/faceRecognition");
const NotificationService = require('./service/notificationService');

// Models
const VitalSignsRecord = require('./models/vital_signs_records');
const TheatrePatients = require('./models/theatre/TheatrePatients');
const PreOpChecklist = require('./models/theatre/PreOpChecklist');
const EducationMaterials = require('./models/theatre/EducationalMaterials');
const PatientAllergies = require('./models/theatre/PatientAllergies');
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
  users: { 'tonitel': 'pa$$word123' },
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
/*                            DATABASE SYNC                                  */
/* -------------------------------------------------------------------------- */

// Store models sync
async function syncStoreModels() {
  try {
    // Import store models to ensure they're loaded
    const Item = require('./models/store/item');
    const ItemBatch = require('./models/store/ItemBatch');
    const Supplier = require('./models/store/Supplier');
    const StockRequest = require('./models/store/StockRequest');
    const StockRequestItem = require('./models/store/StockRequestItem');
    const StockTransfer = require('./models/store/StockTransfer');
    const StockTransferItem = require('./models/store/StockTransferItem');
    const StockAdjustment = require('./models/store/StockAdjustment');
    const StockAlert = require('./models/store/StockAlert');
    const PurchaseOrder = require('./models/store/PurchaseOrder');
    const PurchaseOrderItem = require('./models/store/PurchaseOrderItem');
    const InventoryRecord = require('./models/store/inventoryRecord');
    const IssuedItem = require('./models/store/IssuedItem');
    const ExpiredItem = require('./models/store/ExpiredItem');

    // Sync store models in order (dependencies first)
    await Supplier.sync({ alter: true });
    console.log('✅ Supplier table synced');
    
    await Item.sync({ alter: true });
    console.log('✅ Item table synced');
    
    await ItemBatch.sync({ alter: true });
    console.log('✅ ItemBatch table synced');
    
    await StockRequest.sync({ alter: true });
    console.log('✅ StockRequest table synced');
    
    await StockRequestItem.sync({ alter: true });
    console.log('✅ StockRequestItem table synced');
    
    await StockTransfer.sync({ alter: true });
    console.log('✅ StockTransfer table synced');
    
    await StockTransferItem.sync({ alter: true });
    console.log('✅ StockTransferItem table synced');
    
    await StockAdjustment.sync({ alter: true });
    console.log('✅ StockAdjustment table synced');
    
    await StockAlert.sync({ alter: true });
    console.log('✅ StockAlert table synced');
    
    await PurchaseOrder.sync({ alter: true });
    console.log('✅ PurchaseOrder table synced');
    
    await PurchaseOrderItem.sync({ alter: true });
    console.log('✅ PurchaseOrderItem table synced');
    
    await InventoryRecord.sync({ alter: true });
    console.log('✅ InventoryRecord table synced');
    
    await IssuedItem.sync({ alter: true });
    console.log('✅ IssuedItem table synced');
    
    await ExpiredItem.sync({ alter: true });
    console.log('✅ ExpiredItem table synced');
    
    console.log('✅ All store models synced successfully');
  } catch (error) {
    console.error('❌ Error syncing store models:', error);
  }
}

async function syncVitalSignsRecord() {
  try {
    await VitalSignsRecord.sync({ alter: true });
    console.log('✅ VitalSignsRecord table synced successfully');
  } catch (error) {
    console.error('❌ Error syncing VitalSignsRecord:', error);
  }
}

async function syncTheatre() {
  try {
    // Import OperatingRoom first - it must be synced before TheatrePatients
    const OperatingRoom = require('./models/theatre/OperatingRoom');
    
    // Sync OperatingRoom FIRST (before TheatrePatients which has FK to it)
    await OperatingRoom.sync({ alter: true });
    console.log('✅ OperatingRoom table synced');
    
    // Now sync TheatrePatients (it has FK to OperatingRoom)
    await TheatrePatients.sync({ alter: true });
    console.log('✅ TheatrePatients table synced');
    
    await PreOpChecklist.sync({ alter: true });
    console.log('✅ PreOpChecklist table synced');
    
    await EducationMaterials.sync({ alter: true });
    console.log('✅ EducationMaterials table synced');
    
    await PatientAllergies.sync({ alter: true });
    console.log('✅ PatientAllergies table synced');
    
    console.log('✅ All theatre models synced successfully');
  } catch (error) {
    console.error('❌ Error syncing TheatrePatients:', error);
  }
}

db.sequelize.sync({ alter: true })
  .then(() => {
    console.log('✅ Database synchronized successfully.');
  })
  .catch((error) => { 
    console.error('❌ Error synchronizing the database:', error);
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
const chatService = new ChatService(io);

// Start the server
server.listen(port, '0.0.0.0', async () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
  try {
    // First sync store models (they are needed by other modules)
    await syncStoreModels();
    // Run seeders
    await runAllSeeders();
    // Sync vital signs
    await syncVitalSignsRecord();
    // Sync theatre models (requires OperatingRoom before TheatrePatients)
    await syncTheatre();
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
