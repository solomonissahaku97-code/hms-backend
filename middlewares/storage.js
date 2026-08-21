/**
 * Multer Middleware — Supabase-backed
 *
 * Multer handles multipart form parsing and temporary file storage.
 * After multer processes the file, the sftpUpload middleware (or
 * supabaseUpload middleware below) uploads it to Supabase via StorageService
 * and cleans up the temp file.
 *
 * This replaces the old SFTP-based sftpUpload middleware.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadFromPath, deleteFile } = require('../service/storageService');

// ─── Temp storage (required for multer to write files before Supabase upload) ─
const tempDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

// ─── Base upload instance (5MB, common file types) ──────────────────────────
const upload = multer({
  storage: tempStorage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png|doc|docx|xml|webp|gif|bmp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, PDF, DOC, DOCX, XML, WEBP, GIF files are allowed.'));
    }
  },
});

// ─── Lab attachments upload (10MB, images + PDFs) ──────────────────────────
const labAttachmentsUpload = multer({
  storage: tempStorage,
  limits: { fileSize: 1024 * 1024 * 15 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf|webp|gif/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, WEBP, GIF and PDF files are allowed.'));
    }
  },
});

// ─── Gallery upload (5MB, images only) ──────────────────────────────────────
const galleryUpload = multer({
  storage: tempStorage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, JPEG, PNG, WEBP, GIF) are allowed for gallery.'));
    }
  },
});

// ─── Supabase Upload Middleware ─────────────────────────────────────────────

/**
 * Middleware factory: uploads processed files to Supabase via StorageService.
 *
 * Usage: sftpUpload('fieldName', 'module', 'subpath')
 *
 * After this middleware runs:
 *   - req.body[fieldName] = storagePath (Supabase path, NOT a URL)
 *   - req.storagePaths = array of all uploaded storage paths (for cleanup)
 *   - Temp files are cleaned up
 *
 * The controller should then:
 *   - Store req.body[fieldName] in the database
 *   - Call getSignedUrl() when serving files to clients
 */
const supabaseUpload = (fieldName, module = 'general', subpath = '') => {
  return async (req, res, next) => {
    try {
      const files = Array.isArray(req.files)
        ? req.files
        : req.file
          ? [req.file]
          : [];

      if (files.length === 0) return next();

      // Get institution_id from the authenticated user
      const institutionId = req.admin?.institution_id || req.user?.institution_id;
      if (!institutionId) {
        return res.status(400).json({
          status: 'error',
          message: 'institution_id is required for file upload',
        });
      }

      const targetFiles = files.filter(f => !fieldName || f.fieldname === fieldName);
      if (targetFiles.length === 0) return next();

      req.storagePaths = req.storagePaths || [];

      const uploadResults = await Promise.all(
        targetFiles.map(async (file) => {
          try {
            const result = await uploadFromPath({
              localPath: file.path,
              fileName: file.originalname,
              mimeType: file.mimetype,
              institutionId,
              module,
              subpath,
            });
            req.storagePaths.push(result.storagePath);
            return result.storagePath;
          } catch (err) {
            console.error('Supabase upload error:', err.message);
            // Clean up temp file even on error
            try { fs.unlinkSync(file.path); } catch (e) { /* ignore */ }
            throw err;
          }
        })
      );

      // Set the field on req.body with the storage path(s)
      if (fieldName) {
        req.body[fieldName] = uploadResults.length === 1
          ? uploadResults[0]
          : uploadResults;
      }

      next();
    } catch (err) {
      console.error('Storage middleware error:', err);
      next(err);
    }
  };
};

/**
 * Backward-compatible alias — sftpUpload now uses Supabase.
 * All existing routes that use sftpUpload() will transparently migrate.
 */
const sftpUpload = supabaseUpload;

module.exports = {
  upload,
  labAttachmentsUpload,
  galleryUpload,
  supabaseUpload,
  sftpUpload,
};
