// System Management Routes
const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

// Backup routes
router.post('/backup/create', systemController.createBackup);
router.get('/backup/list', systemController.listBackups);
router.delete('/backup/:backupId', systemController.deleteBackup);
router.get('/backup/download/:backupId', systemController.downloadBackup);
router.post('/backup/restore/:backupId', systemController.restoreBackup);

// Backup Settings routes
router.get('/backup/settings', systemController.getBackupSettings);
router.put('/backup/settings', systemController.updateBackupSettings);

// System config routes
router.get('/config', systemController.getSystemConfig);
router.put('/config', systemController.updateSystemConfig);
router.get('/config/database', systemController.getDatabaseInfo);
router.post('/config/test-email', systemController.testEmailConnection);

// System health
router.get('/health', systemController.getSystemHealth);

// Dashboard statistics
router.get('/dashboard/stats', systemController.getDashboardStats);

// ==================== DATA MANAGEMENT ROUTES ====================

// Database tables - get all tables with record counts
router.get('/data/tables', systemController.getDatabaseTables);

// Sync a specific table
router.post('/data/sync/:tableName', systemController.syncTable);

// Sync all tables
router.post('/data/sync-all', systemController.syncAllTables);

// Export table data
router.get('/data/export/:tableName', systemController.exportTable);

// Clear table data
router.delete('/data/clear/:tableName', systemController.clearTable);

// Get storage information
router.get('/data/storage', systemController.getStorageInfo);

// Data cleanup operations
router.post('/data/cleanup/:operation', systemController.dataCleanup);

// Data retention policies
router.get('/data/retention', systemController.getRetentionPolicies);
router.put('/data/retention', systemController.updateRetentionPolicies);

module.exports = router;

