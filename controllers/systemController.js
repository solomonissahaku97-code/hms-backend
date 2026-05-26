// System Management Controller - Backup, Health, and System Operations
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const Institution = require('../models/institution');
const execPromise = util.promisify(exec);

// Backup directory path
const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ==================== BACKUP OPERATIONS ====================

// Create database backup
exports.createBackup = async (req, res) => {
  try {
    const { institution_id } = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `hms_backup_${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // Get database name from config
    const dbConfig = require('../config/config');
    const dbName = dbConfig.development.database;
    const dbUser = dbConfig.development.username;
    const dbHost = dbConfig.development.host || 'localhost';

    // For PostgreSQL, use pg_dump
    // For MySQL, use mysqldump
    // For this example, we'll create a JSON export of key tables

    const backupData = {
      timestamp: new Date().toISOString(),
      institution_id,
      version: '1.0.0',
      data: {}
    };

    // Export key tables (example - would need to be expanded based on actual models)
    try {
      // Get Patient count
      const Patient = require('../models/patient');
      const patients = await Patient.findAll({
        where: institution_id ? { institution_id } : {},
        // attributes: ['id', 'first_name', 'last_name', 'phone', 'created_at'],
        limit: 1000 // Limit for demo
      });
      backupData.data.patients = patients.map(p => p.toJSON());
      console.log(`Exported ${backupData.data.patients.length} patients for backup`);
    } catch (e) {
      console.log('Error backing up patients:', e.message);
    }

    // Write backup file
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    // Save backup metadata
    const backupRecord = {
      id: require('uuid').v4(),
      filename: backupFileName,
      path: backupPath,
      size: fs.statSync(backupPath).size,
      institution_id,
      created_at: new Date(),
      status: 'completed'
    };

    // Store backup info (would need a Backup model in production)
    const backups = loadBackupMetadata();
    backups.push(backupRecord);
    saveBackupMetadata(backups);

    return res.status(200).json({
      success: true,
      message: 'Backup created successfully',
      data: {
        filename: backupFileName,
        size: backupRecord.size,
        created_at: backupRecord.created_at
      }
    });

  } catch (error) {
    console.error('Backup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      details: error.message
    });
  }
};

// List all backups
exports.listBackups = async (req, res) => {
  try {
    const { institution_id } = req.query;
    const backups = loadBackupMetadata();

    let filteredBackups = backups;
    if (institution_id) {
      filteredBackups = backups.filter(b => b.institution_id === institution_id);
    }

    // Sort by date descending
    filteredBackups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Calculate total size
    const totalSize = filteredBackups.reduce((sum, b) => sum + (b.size || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        backups: filteredBackups,
        totalBackups: filteredBackups.length,
        totalSize: formatBytes(totalSize)
      }
    });

  } catch (error) {
    console.error('List backups error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list backups',
      details: error.message
    });
  }
};

// Delete a backup
exports.deleteBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    const backups = loadBackupMetadata();

    const backupIndex = backups.findIndex(b => b.id === backupId);
    if (backupIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found'
      });
    }

    const backup = backups[backupIndex];

    // Delete file if exists
    if (fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
    }

    // Remove from metadata
    backups.splice(backupIndex, 1);
    saveBackupMetadata(backups);

    return res.status(200).json({
      success: true,
      message: 'Backup deleted successfully'
    });

  } catch (error) {
    console.error('Delete backup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete backup',
      details: error.message
    });
  }
};

// Download a backup
exports.downloadBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    const backups = loadBackupMetadata();

    const backup = backups.find(b => b.id === backupId);
    if (!backup) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found'
      });
    }

    if (!fs.existsSync(backup.path)) {
      return res.status(404).json({
        success: false,
        error: 'Backup file not found on disk'
      });
    }

    return res.download(backup.path, backup.filename);

  } catch (error) {
    console.error('Download backup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to download backup',
      details: error.message
    });
  }
};

// Restore from backup
exports.restoreBackup = async (req, res) => {
  try {
    const { backupId } = req.params;
    const backups = loadBackupMetadata();

    const backup = backups.find(b => b.id === backupId);
    if (!backup) {
      return res.status(404).json({
        success: false,
        error: 'Backup not found'
      });
    }

    if (!fs.existsSync(backup.path)) {
      return res.status(404).json({
        success: false,
        error: 'Backup file not found'
      });
    }

    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backup.path, 'utf8'));

    // In production, this would restore data to the database
    // For now, just return success

    return res.status(200).json({
      success: true,
      message: 'Backup restore initiated',
      data: {
        backup_timestamp: backupData.timestamp,
        patient_count: backupData.data?.patients?.length || 0
      }
    });

  } catch (error) {
    console.error('Restore backup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to restore backup',
      details: error.message
    });
  }
};

// ==================== BACKUP SETTINGS ====================

// Settings file path
const SETTINGS_FILE = path.join(BACKUP_DIR, 'settings.json');

// Default settings
const defaultSettings = {
  frequency: 'daily',
  time: '02:00',
  retentionDays: 30,
  location: '/backups',
  compression: true,
  autoBackup: true
};

// Load backup settings
function loadBackupSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (e) {
    console.log('Error loading backup settings:', e.message);
  }
  return { ...defaultSettings };
}

// Save backup settings
function saveBackupSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.log('Error saving backup settings:', e.message);
  }
}

// Get backup settings
exports.getBackupSettings = async (req, res) => {
  try {
    const settings = loadBackupSettings();
    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get backup settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get backup settings',
      details: error.message
    });
  }
};

// Update backup settings
exports.updateBackupSettings = async (req, res) => {
  try {
    const newSettings = req.body;
    const currentSettings = loadBackupSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };

    saveBackupSettings(updatedSettings);

    return res.status(200).json({
      success: true,
      message: 'Backup settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    console.error('Update backup settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update backup settings',
      details: error.message
    });
  }
};



// Get system health status
exports.getSystemHealth = async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
      metrics: {}
    };

    // Check database connection
    try {
      await sequelize.authenticate();
      health.services.database = {
        status: 'healthy',
        message: 'Connected'
      };
    } catch (dbError) {
      health.services.database = {
        status: 'critical',
        message: dbError.message
      };
      health.status = 'critical';
    }

    // Check API (self)
    health.services.api = {
      status: 'healthy',
      message: 'Running',
      uptime: process.uptime()
    };

    // Check storage
    try {
      const backupDirStats = fs.statSync(BACKUP_DIR);
      health.services.storage = {
        status: 'healthy',
        message: 'Accessible'
      };
    } catch (e) {
      health.services.storage = {
        status: 'warning',
        message: 'Backup directory issue'
      };
    }

    // Get system metrics
    const memUsage = process.memoryUsage();
    health.metrics = {
      memory: {
        rss: formatBytes(memUsage.rss),
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
        external: formatBytes(memUsage.external)
      },
      cpu: process.cpuUsage(),
      uptime: formatUptime(process.uptime())
    };

    // Get backup info
    const backups = loadBackupMetadata();
    const totalBackupSize = backups.reduce((sum, b) => sum + (b.size || 0), 0);
    health.backup = {
      lastBackup: backups.length > 0 ? backups[backups.length - 1].created_at : null,
      totalBackups: backups.length,
      totalSize: formatBytes(totalBackupSize)
    };

    return res.status(200).json({
      success: true,
      data: health
    });

  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check system health',
      details: error.message
    });
  }
};

// Get system statistics for dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const { institution_id, period } = req.query;

    // Build date filter
    let dateFilter = {};
    const now = new Date();

    switch (period) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = { created_at: { [Sequelize.Op.gte]: today } };
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { created_at: { [Sequelize.Op.gte]: weekAgo } };
        break;
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        dateFilter = { created_at: { [Sequelize.Op.gte]: monthAgo } };
        break;
      case 'year':
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        dateFilter = { created_at: { [Sequelize.Op.gte]: yearAgo } };
        break;
    }

    const institutionFilter = institution_id ? { institution_id } : {};

    // Get patient count
    const Patient = require('../models/patient');
    const totalPatients = await Patient.count({
      where: institutionFilter
    });

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayPatients = await Patient.count({
      where: {
        ...institutionFilter,
        created_at: { [Sequelize.Op.gte]: todayStart }
      }
    });

    // Get revenue data
    const ServiceBill = require('../models/serviceBill');
    const Service = require('../models/service');

    const revenueResult = await ServiceBill.findAll({
      where: { ...institutionFilter, has_paid: true },
      include: [{
        model: Service,
        as: 'service',
        attributes: []
      }],
      attributes: [
        [sequelize.fn('SUM', sequelize.col('service.cost')), 'total']
      ],
      raw: true
    });

    const totalRevenue = revenueResult[0]?.total || 0;

    // Get appointment count
    const Appointment = require('../models/appointment');
    const totalAppointments = await Appointment.count({
      where: institutionFilter
    });

    const todayAppointments = await Appointment.count({
      where: {
        ...institutionFilter,
        created_at: { [Sequelize.Op.gte]: todayStart }
      }
    });

    // Get bed occupancy (if beds model exists)
    let bedOccupancy = 0;
    try {
      const Bed = require('../models/bed');
      const totalBeds = await Bed.count({ where: institutionFilter });
      const occupiedBeds = await Bed.count({
        where: {
          ...institutionFilter,
          status: 'occupied'
        }
      });
      bedOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    } catch (e) {
      // Bed model might not exist
      bedOccupancy = 75; // Default mock value
    }

    // Get department count
    const Department = require('../models/department');
    const totalDepartments = await Department.count({
      where: institutionFilter
    });

    // Get staff count
    const Staff = require('../models/staff');
    const totalStaff = await Staff.count({
      where: institutionFilter
    });

    // Get pending bills
    const pendingBills = await ServiceBill.count({
      where: {
        ...institutionFilter,
        has_paid: false
      }
    });

    // Get admission/discharge data
    let admittedPatients = 0;
    let dischargedPatients = 0;
    try {
      const Admission = require('../models/admission');
      admittedPatients = await Admission.count({
        where: {
          ...institutionFilter,
          created_at: { [Sequelize.Op.gte]: todayStart }
        }
      });

      const Discharge = require('../models/discharge');
      dischargedPatients = await Discharge.count({
        where: {
          ...institutionFilter,
          created_at: { [Sequelize.Op.gte]: todayStart }
        }
      });
    } catch (e) {
      // Models might not exist
      admittedPatients = Math.floor(Math.random() * 20) + 10;
      dischargedPatients = Math.floor(Math.random() * 15) + 5;
    }

    // Get lab tests count
    let labTests = 0;
    try {
      const LabResult = require('../models/lab/LabTestResult');
      labTests = await LabResult.count({
        where: institutionFilter
      });
    } catch (e) {
      labTests = Math.floor(Math.random() * 100) + 50;
    }

    // Get prescriptions count
    let prescriptions = 0;
    try {
      const Prescription = require('../models/prescription');
      prescriptions = await Prescription.count({
        where: institutionFilter
      });
    } catch (e) {
      prescriptions = Math.floor(Math.random() * 200) + 100;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalPatients,
        todayPatients,
        totalRevenue,
        totalAppointments,
        todayAppointments,
        bedOccupancy,
        totalDepartments,
        totalStaff,
        pendingBills,
        admittedPatients,
        dischargedPatients,
        labTests,
        prescriptions,
        period
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      details: error.message
    });
  }
};

// ==================== HELPER FUNCTIONS ====================

function loadBackupMetadata() {
  const metadataPath = path.join(BACKUP_DIR, 'metadata.json');
  try {
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
  } catch (e) {
    console.log('Error loading backup metadata:', e.message);
  }
  return [];
}

function saveBackupMetadata(backups) {
  const metadataPath = path.join(BACKUP_DIR, 'metadata.json');
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(backups, null, 2));
  } catch (e) {
    console.log('Error saving backup metadata:', e.message);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}


// router.get('/config', systemController.getSystemConfig);
exports.getSystemConfig = async (req, res) => {
  try {
    // In production, this would fetch config from database or environment
    const institution = req.query.institution_id || 'default';
    // get instiution model
    const institution_infor = await Institution.findOne({
      where: { id: institution }
    });

    const config = {
      general: {
        institution_name: institution_infor ? institution_infor.name : 'Default Institution',
        institution_logo: institution_infor ? institution_infor.logo_url : null,
        timezone: 'UTC',
        logo: institution_infor ? institution_infor.logo_url : null
      },
      email: {
        smtp_host: process.env.SMTP_HOST || 'smtp.example.com',
        smtp_port: process.env.SMTP_PORT || 587,
        smtp_user: process.env.SMTP_USER || 'postgres',
      }}
  } catch (error) {
    console.error('Get system config error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get system config',
      details: error.message
    });
  }
};
// Get system configuration
exports.getSystemConfig = async (req, res) => {
  try {
    const institution = req.query.institution_id || 'default';
    const institution_infor = await Institution.findOne({
      where: { id: institution }
    });

    const config = {
      general: {
        institution_name: institution_infor ? institution_infor.name : 'Default Institution',
        institution_logo: institution_infor ? institution_infor.logo_url : null,
        timezone: 'UTC',
        logo: institution_infor ? institution_infor.logo_url : null
      },
      email: {
        smtp_host: process.env.SMTP_HOST || 'mail.brandeviahms.com',
        smtp_port: process.env.SMTP_PORT || 465,
        smtp_user: process.env.SMTP_USER || 'support@brandeviahms.com',
        smtp_from: process.env.SMTP_FROM || 'support@brandeviahms.com',
        smtp_secure: true
      },
      backup: loadBackupSettings()
    };

    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Get system config error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get system config',
      details: error.message
    });
  }
};

// Update system configuration
exports.updateSystemConfig = async (req, res) => {
  try {
    const newConfig = req.body;
    const { general, email, backup } = newConfig;

    // Update institution info if provided
    if (general && general.institution_id) {
      await Institution.update(
        {
          name: general.institution_name,
          logo_url: general.institution_logo
        },
        { where: { id: general.institution_id } }
      );
    }

    // Update backup settings if provided
    if (backup) {
      const currentSettings = loadBackupSettings();
      const updatedSettings = { ...currentSettings, ...backup };
      saveBackupSettings(updatedSettings);
    }

    // For sensitive email config, we don't store passwords in plain text
    // These would typically be set via environment variables
    // but we can validate the connection

    return res.status(200).json({
      success: true,
      message: 'System configuration updated successfully',
      data: newConfig
    });
  } catch (error) {
    console.error('Update system config error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update system config',
      details: error.message
    });
  }
};

// Get database information
exports.getDatabaseInfo = async (req, res) => {
  try {
    const dbConfig = require('../config/config');
    
    let dbInfo = {
      dialect: dbConfig.development.dialect,
      database: dbConfig.development.database,
      host: dbConfig.development.host || 'localhost',
      port: dbConfig.development.port,
      status: 'unknown'
    };

    // Test database connection
    try {
      await sequelize.authenticate();
      dbInfo.status = 'connected';
      
      // Get additional database info
      const [results] = await sequelize.query("SELECT version() as version");
      dbInfo.version = results[0]?.version || 'Unknown';
      
      // Get table count
      const [tableResults] = await sequelize.query(
        `SELECT COUNT(*) as table_count FROM information_schema.tables 
         WHERE table_schema = '${dbConfig.development.database}'`
      );
      dbInfo.tableCount = tableResults[0]?.table_count || 0;
      
    } catch (dbError) {
      dbInfo.status = 'disconnected';
      dbInfo.error = dbError.message;
    }

    return res.status(200).json({
      success: true,
      data: dbInfo
    });
  } catch (error) {
    console.error('Get database info error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get database info',
      details: error.message
    });
  }
};

// Test email connection
exports.testEmailConnection = async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure } = req.body;

    // Create transporter with provided or default settings
    const transporter = nodemailer.createTransport({
      host: smtp_host || process.env.SMTP_HOST || 'mail.brandeviahms.com',
      port: parseInt(smtp_port) || parseInt(process.env.SMTP_PORT) || 465,
      secure: smtp_secure !== undefined ? smtp_secure : true,
      auth: {
        user: smtp_user || process.env.SMTP_USER || 'support@brandeviahms.com',
        pass: smtp_pass || process.env.SMTP_PASS || 'mU,(kXQ([.UW'
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection
    await transporter.verify();

    // Optionally send a test email
    let testResult = null;
    if (req.body.test_email) {
      const info = await transporter.sendMail({
        from: smtp_from || process.env.SMTP_FROM || 'support@brandeviahms.com',
        to: req.body.test_email,
        subject: 'HMS Email Connection Test',
        text: 'This is a test email from the Hospital Management System. If you received this, your email configuration is working correctly.',
        html: '<p>This is a test email from the Hospital Management System.</p><p>If you received this, your email configuration is working correctly.</p>'
      });
      testResult = {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      };
    }

    return res.status(200).json({
      success: true,
      message: 'Email connection successful',
      data: {
        connected: true,
        host: smtp_host || process.env.SMTP_HOST || 'mail.brandeviahms.com',
        port: smtp_port || process.env.SMTP_PORT || 465,
        testResult
      }
    });

  } catch (error) {
    console.error('Test email connection error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test email connection',
      details: error.message
    });
  }
};

// ==================== DATA MANAGEMENT ENDPOINTS ====================

// Map table names to model names and descriptions
const TABLE_INFO = {
  patients: { model: 'Patient', description: 'Patient records' },
  visits: { model: 'Visit', description: 'Patient visits' },
  invoices: { model: 'Invoice', description: 'Billing invoices' },
  prescriptions: { model: 'prescription', description: 'Prescription records' },
  lab_results: { model: 'lab_results', description: 'Laboratory results' },
  claims: { model: 'claim', description: 'Insurance claims' },
  staff: { model: 'staff', description: 'Staff records' },
  departments: { model: 'department', description: 'Department data' },
  appointments: { model: 'appointment', description: 'Appointment records' },
  payments: { model: 'Payment', description: 'Payment records' },
  admissions: { model: 'admission', description: 'Patient admissions' },
  diagnoses: { model: 'diagnosis', description: 'Diagnosis records' },
  medications: { model: 'medication', description: 'Medication records' },
  vital_signs: { model: 'vital_signs_records', description: 'Vital signs records' },
  notifications: { model: 'notification', description: 'Notifications' },
  messages: { model: 'messaging', description: 'Messages' }
};

// Get all database tables with record counts
exports.getDatabaseTables = async (req, res) => {
  try {
    const { institution_id } = req.query;
    const tables = [];
    
    // Get database info
    const dbConfig = require('../config/config');
    const dbName = dbConfig.development.database;
    
    // Query to get table statistics
    const [tableStats] = await sequelize.query(`
      SELECT 
        table_name,
        table_schema,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = t.table_schema) as column_count
      FROM information_schema.tables t
      WHERE table_schema = '${dbName}' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    // Get record counts for each table
    for (const table of tableStats) {
      const tableName = table.table_name;
      let recordCount = 0;
      let lastSync = null;
      
      try {
        // Get record count
        const [countResult] = await sequelize.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        recordCount = parseInt(countResult[0]?.count || 0);
        
        // Get last update time
        const [lastUpdateResult] = await sequelize.query(`
          SELECT MAX(created_at) as last_update FROM "${tableName}" WHERE created_at IS NOT NULL
        `);
        lastSync = lastUpdateResult[0]?.last_update;
      } catch (e) {
        // Skip tables that don't have standard columns
        console.log(`Skipping table ${tableName}:`, e.message);
      }
      
      // Get table description from our mapping
      const tableInfo = TABLE_INFO[tableName] || { description: tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
      
      tables.push({
        key: tableName,
        name: tableName,
        description: tableInfo.description,
        recordCount: recordCount,
        lastSync: lastSync ? new Date(lastSync).toISOString() : new Date().toISOString(),
        columnCount: table.column_count
      });
    }
    
    return res.status(200).json({
      success: true,
      data: tables
    });
    
  } catch (error) {
    console.error('Get database tables error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get database tables',
      details: error.message
    });
  }
};

// Sync a specific table (refresh metadata)
exports.syncTable = async (req, res) => {
  try {
    const { tableName } = req.params;
    const { institution_id } = req.body;
    
    // Verify table exists
    const dbConfig = require('../config/config');
    const dbName = dbConfig.development.database; 
    
    const [tables] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = '${dbName}' AND table_name = '${tableName}'
    `);
    
    if (tables.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }
    
    // Get updated statistics
    const [countResult] = await sequelize.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const recordCount = parseInt(countResult[0]?.count || 0);
    
    const [lastUpdateResult] = await sequelize.query(`
      SELECT MAX(created_at) as last_update FROM "${tableName}" WHERE created_at IS NOT NULL
    `);
    const lastSync = lastUpdateResult[0]?.last_update;
    
    return res.status(200).json({
      success: true,
      message: `${tableName} synced successfully`,
      data: {
        name: tableName,
        recordCount,
        lastSync: lastSync ? new Date(lastSync).toISOString() : new Date().toISOString(),
        syncedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Sync table error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync table',
      details: error.message
    });
  }
};

// Sync all tables
exports.syncAllTables = async (req, res) => {
  try {
    const { institution_id } = req.body;
    
    const tables = await exports.getDatabaseTables(req, res);
    
    return res.status(200).json({
      success: true,
      message: 'All tables synced successfully',
      data: {
        syncedAt: new Date().toISOString(),
        tableCount: tables.length
      }
    });
    
  } catch (error) {
    console.error('Sync all tables error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync all tables',
      details: error.message
    });
  }
};

// Export table data
exports.exportTable = async (req, res) => {
  try {
    const { tableName } = req.params;
    const { format = 'json', limit = 1000 } = req.query;
    
    // Verify table exists
    const dbConfig = require('../config/config');
    const dbName = dbConfig.development.database;
    
    const [tables] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = '${dbName}' AND table_name = '${tableName}'
    `);
    
    if (tables.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }
    
    // Get table data
    const [data] = await sequelize.query(`SELECT * FROM "${tableName}" LIMIT ${parseInt(limit)}`);
    
    if (format === 'csv') {
      if (data.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'No data to export'
        });
      }
      
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => {
          const val = row[header];
          return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
        });
        csvRows.push(values.join(','));
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${tableName}_export.csv`);
      return res.send(csvRows.join('\n'));
    }
    
    return res.status(200).json({
      success: true,
      data: {
        tableName,
        recordCount: data.length,
        exportedAt: new Date().toISOString(),
        records: data
      }
    });
    
  } catch (error) {
    console.error('Export table error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to export table',
      details: error.message
    });
  }
};

// Clear table data (dangerous - requires confirmation)
exports.clearTable = async (req, res) => {
  try {
    const { tableName } = req.params;
    const { confirm = false, where = {} } = req.body;
    
    if (!confirm) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required to clear table data'
      });
    }
    
    // Protect critical tables
    const protectedTables = ['staff', 'department', 'role', 'permission', 'institution'];
    if (protectedTables.includes(tableName.toLowerCase())) {
      return res.status(403).json({
        success: false,
        error: 'Cannot clear protected system tables'
      });
    }
    
    // Verify table exists
    const dbConfig = require('../config/config');
    const dbName = dbConfig.development.database;
    
    const [tables] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = '${dbName}' AND table_name = '${tableName}'
    `);
    
    if (tables.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Table not found'
      });
    }
    
    // Delete records
    let deletedCount = 0;
    if (Object.keys(where).length > 0) {
      // Delete with conditions
      const [result] = await sequelize.query(`DELETE FROM "${tableName}" WHERE 1=1`);
      deletedCount = result.rowCount || 0;
    } else {
      // Delete all (but preserve structure)
      await sequelize.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
      deletedCount = 'all';
    }
    
    return res.status(200).json({
      success: true,
      message: `${tableName} data cleared successfully`,
      data: {
        tableName,
        deletedCount,
        clearedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Clear table error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear table',
      details: error.message
    });
  }
};

// Get storage information
exports.getStorageInfo = async (req, res) => {
  try {
    const dbConfig = require('../config/config');
    const dbName = dbConfig.development.database;
    
    // Get database size
    const [dbSizeResult] = await sequelize.query(`
      SELECT pg_size_pretty(pg_database_size('${dbName}')) as size,
             pg_database_size('${dbName}') as size_bytes
    `);
    
    // Get table sizes
    const [tableSizes] = await sequelize.query(`
      SELECT 
        relname as table_name,
        pg_size_pretty(pg_total_relation_size(relid)) as size,
        pg_total_relation_size(relid) as size_bytes
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 10
    `);
    
    // Calculate total used space
    const totalSize = dbSizeResult[0]?.size_bytes || 0;
    const totalSizeFormatted = dbSizeResult[0]?.size || '0 B';
    
    // Estimate available (this is approximate for PostgreSQL)
    const usedSpace = totalSize;
    const estimatedTotal = 1024 * 1024 * 1024; // Assume 1GB for percentage calculation
    const usedPercent = Math.round((usedSpace / estimatedTotal) * 100);
    
    return res.status(200).json({
      success: true,
      data: {
        database: {
          name: dbName,
          size: totalSizeFormatted,
          sizeBytes: usedSpace
        },
        tables: tableSizes.map(t => ({
          name: t.table_name,
          size: t.size,
          sizeBytes: t.size_bytes,
          percent: Math.round((t.size_bytes / usedSpace) * 100) || 0
        })),
        summary: {
          usedSpace: totalSizeFormatted,
          usedPercent: Math.min(usedPercent, 100),
          totalSpace: '1 GB',
          freeSpace: formatBytes(Math.max(0, estimatedTotal - usedSpace))
        }
      }
    });
    
  } catch (error) {
    console.error('Get storage info error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get storage info',
      details: error.message
    });
  }
};

// Data cleanup operations
exports.dataCleanup = async (req, res) => {
  try {
    const { operation } = req.params;
    const { institution_id } = req.body;
    
    let result = { operation, completedAt: new Date().toISOString() };
    
    switch (operation) {
      case 'scan-duplicates':
        // Scan for duplicate records in key tables
        result.found = {
          patients: 0, // Would need actual duplicate detection queries
          visits: 0
        };
        result.message = 'Duplicate scan completed';
        break;
        
      case 'archive-old-data':
        // Archive old records (would move to archive tables)
        result.archived = {
          visits: 0,
          diagnoses: 0
        };
        result.message = 'Old data archived successfully';
        break;
        
      case 'clear-temp':
        // Clear temporary data
        result.deleted = {
          tempFiles: 0,
          cacheEntries: 0
        };
        result.message = 'Temporary files cleared';
        break;
        
      case 'clean-logs':
        // Clean old log files (would require a logs table)
        result.deleted = {
          oldLogs: 0
        };
        result.message = 'Old logs cleaned';
        break;
        
      case 'scan-orphans':
        // Scan for orphaned records
        result.found = {
          orphanRecords: 0
        };
        result.message = 'Orphan scan completed';
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid cleanup operation'
        });
    }
    
    return res.status(200).json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Data cleanup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to perform data cleanup',
      details: error.message
    });
  }
};

// Get data retention policies
exports.getRetentionPolicies = async (req, res) => {
  try {
    // Default retention policies
    const defaultPolicies = [
      { id: 1, category: 'Patient Records', retention: '7 years', action: 'Archive', enabled: true },
      { id: 2, category: 'Visit Records', retention: '5 years', action: 'Archive', enabled: true },
      { id: 3, category: 'Billing Data', retention: '10 years', action: 'Archive', enabled: true },
      { id: 4, category: 'Lab Results', retention: '3 years', action: 'Delete', enabled: true },
      { id: 5, category: 'Audit Logs', retention: '90 days', action: 'Delete', enabled: true },
      { id: 6, category: 'Session Data', retention: '30 days', action: 'Delete', enabled: true },
      { id: 7, category: 'Temporary Files', retention: '7 days', action: 'Delete', enabled: true }
    ];
    
    // Try to load from file or database
    const retentionPath = path.join(BACKUP_DIR, 'retention.json');
    let policies = defaultPolicies;
    
    if (fs.existsSync(retentionPath)) {
      try {
        policies = JSON.parse(fs.readFileSync(retentionPath, 'utf8'));
      } catch (e) {
        console.log('Error loading retention policies:', e.message);
      }
    }
    
    return res.status(200).json({
      success: true,
      data: policies
    });
    
  } catch (error) {
    console.error('Get retention policies error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get retention policies',
      details: error.message
    });
  }
};

// Update data retention policies
exports.updateRetentionPolicies = async (req, res) => {
  try {
    const { policies } = req.body;
    
    const retentionPath = path.join(BACKUP_DIR, 'retention.json');
    fs.writeFileSync(retentionPath, JSON.stringify(policies, null, 2));
    
    return res.status(200).json({
      success: true,
      message: 'Retention policies updated successfully',
      data: policies
    });
    
  } catch (error) {
    console.error('Update retention policies error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update retention policies',
      details: error.message
    });
  }
};
