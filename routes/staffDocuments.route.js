const express = require('express');
const router = express.Router();

const eitherAuthOrAdminMiddleware = require('../middlewares/eitherAuthOrAdminMiddleware');

const {
  getDocumentsByStaff,
  createDocument,
  updateDocumentStatus,
  updateDocument,
  deleteDocument,
} = require('../controllers/hr_controller/staffDocuments.controller');

// List documents for a staff member
router.get('/staff/:staffId', eitherAuthOrAdminMiddleware, getDocumentsByStaff);

// Create document
router.post('/', eitherAuthOrAdminMiddleware, createDocument);

// Update status only
router.patch('/:id/status', eitherAuthOrAdminMiddleware, updateDocumentStatus);

// Update document fields
router.put('/:id', eitherAuthOrAdminMiddleware, updateDocument);

// Delete document
router.delete('/:id', eitherAuthOrAdminMiddleware, deleteDocument);

module.exports = router;

