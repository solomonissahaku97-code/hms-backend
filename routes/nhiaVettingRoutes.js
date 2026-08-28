const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const nhiaVettingController = require('../controllers/claims/nhiaVettingController');

// XML-only multer upload for NHIA vetting (uses centralized temp storage)
const tempDir = path.join(__dirname, '../uploads/temp');
const nhiaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempDir),
    filename: (req, file, cb) => {
      cb(null, `nhia-${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const isXML = file.mimetype === 'text/xml' || file.mimetype === 'application/xml' || file.originalname.toLowerCase().endsWith('.xml');
    if (isXML) {
      cb(null, true);
    } else {
      cb(new Error('Only XML files are allowed'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Middleware to track processing time
router.use((req, res, next) => {
  req.startTime = new Date();
  next();
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB'
      });
    }
  }
  
  if (error.message === 'Only XML files are allowed') {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  next(error);
};

// Routes — parse and vet XML locally (no Supabase persistence needed for vetting)
router.post('/upload', 
  nhiaUpload.single('xmlFile'),
  handleMulterError,
  nhiaVettingController.processNHIAXML
);

router.get('/validation-rules', 
  nhiaVettingController.getValidationRules
);

router.get('/mappings', 
  nhiaVettingController.getNHIAMappings
);

router.post('/mappings', 
  nhiaVettingController.createNHIAMapping
);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'NHIA Vetting API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Catch-all for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    availableRoutes: [
      'POST /api/nhia-vetting/upload',
      'GET /api/nhia-vetting/validation-rules',
      'GET /api/nhia-vetting/mappings',
      'POST /api/nhia-vetting/mappings',
      'GET /api/nhia-vetting/health'
    ]
  });
});

module.exports = router;
