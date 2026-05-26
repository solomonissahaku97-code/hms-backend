const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nhiaVettingController = require('../controllers/claims/nhiaVettingController');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/nhia');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `nhia-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['text/xml', 'application/xml'];
  const isXML = allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.xml');
  
  if (isXML) {
    cb(null, true);
  } else {
    cb(new Error('Only XML files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
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

// Routes
router.post('/upload', 
  upload.single('xmlFile'),
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
  // Add authentication middleware here if needed
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