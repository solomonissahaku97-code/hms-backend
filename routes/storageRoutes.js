/**
 * Storage Routes — Signed URL resolution
 *
 * Frontend calls these endpoints to get temporary signed URLs
 * for files stored in Supabase Storage.
 *
 * Security: Every request is authenticated and the user's institution
 * is verified against the storage path before generating a signed URL.
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authMiddlewares');
const eitherAuthOrAdmin = require('../middlewares/eitherAuthOrAdminMiddleware');
const { getSignedUrl, getSignedUrls, deleteFile, BUCKET_NAME } = require('../service/storageService');
const { getSupabaseClient } = require('../config/supabase');

/**
 * POST /storage/signed-url
 * Generate a signed URL for a single file.
 * Body: { storagePath: "institutions/123/lab/results/..." }
 */
router.post('/signed-url', eitherAuthOrAdmin, async (req, res) => {
  try {
    const { storagePath } = req.body;
    const expiresIn = parseInt(req.query.expiresIn) || 3600;

    if (!storagePath) {
      return res.status(400).json({ success: false, message: 'storagePath is required' });
    }

    // Multi-tenancy security: verify the path belongs to the user's institution
    const institutionId = String(req.admin?.institution_id || req.user?.institution_id);
    if (!institutionId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Extract institution ID from the storage path
    const pathInstitutionId = storagePath.split('/')[1]; // institutions/{id}/...
    if (pathInstitutionId !== institutionId) {
      return res.status(403).json({ success: false, message: 'Access denied: institution mismatch' });
    }

    const signedUrl = await getSignedUrl({ storagePath, expiresIn });

    res.status(200).json({ success: true, data: { signedUrl, expiresIn } });
  } catch (error) {
    console.error('Error generating signed URL:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /storage/signed-urls
 * Generate signed URLs for multiple files.
 * Body: { storagePaths: ["path1", "path2"] }
 */
router.post('/signed-urls', eitherAuthOrAdmin, async (req, res) => {
  try {
    const { storagePaths } = req.body;
    const expiresIn = parseInt(req.query.expiresIn) || 3600;

    if (!Array.isArray(storagePaths) || storagePaths.length === 0) {
      return res.status(400).json({ success: false, message: 'storagePaths array is required' });
    }

    const institutionId = String(req.admin?.institution_id || req.user?.institution_id);
    if (!institutionId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Multi-tenancy: filter out paths that don't belong to the user's institution
    const authorizedPaths = storagePaths.filter(sp => {
      const parts = sp.split('/');
      return parts[0] === 'institutions' && parts[1] === institutionId;
    });

    if (authorizedPaths.length !== storagePaths.length) {
      console.warn(`Institution ${institutionId} attempted to access ${storagePaths.length - authorizedPaths.length} unauthorized paths`);
    }

    const signedUrls = await getSignedUrls(authorizedPaths, expiresIn);

    res.status(200).json({ success: true, data: signedUrls });
  } catch (error) {
    console.error('Error generating signed URLs:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /storage/file
 * Delete a file from Supabase Storage.
 * Body: { storagePath: "institutions/123/..." }
 */
router.delete('/file', eitherAuthOrAdmin, async (req, res) => {
  try {
    const { storagePath } = req.body;

    if (!storagePath) {
      return res.status(400).json({ success: false, message: 'storagePath is required' });
    }

    const institutionId = String(req.admin?.institution_id || req.user?.institution_id);
    if (!institutionId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Multi-tenancy security
    const pathInstitutionId = storagePath.split('/')[1];
    if (pathInstitutionId !== institutionId) {
      return res.status(403).json({ success: false, message: 'Access denied: institution mismatch' });
    }

    const deleted = await deleteFile(storagePath);

    if (deleted) {
      res.status(200).json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'File not found or already deleted' });
    }
  } catch (error) {
    console.error('Error deleting file:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
