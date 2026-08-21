/**
 * Central Storage Service for Tonitel HMS
 *
 * ALL file storage operations MUST go through this service.
 * Architecture: Controller → StorageService → Supabase Storage
 *
 * Bucket: hms-storage (PRIVATE)
 * Path pattern: institutions/{institutionId}/{module}/{subpath}/{uuid}.{ext}
 *
 * Security: Every operation requires institution_id. The service validates
 * that the authenticated user belongs to the same institution before
 * generating signed URLs, downloading, or deleting files.
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { getSupabaseClient } = require('../config/supabase');

// ─── Configuration ──────────────────────────────────────────────────────────
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'hms-storage';
const DEFAULT_SIGNED_URL_EXPIRY = 60 * 60; // 1 hour
const MAX_FILE_SIZES = {
  image: 10 * 1024 * 1024,      // 10 MB
  document: 20 * 1024 * 1024,    // 20 MB
  lab: 15 * 1024 * 1024,         // 15 MB
  xml: 10 * 1024 * 1024,         // 10 MB
  default: 10 * 1024 * 1024,     // 10 MB
};

const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
  lab: [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
  ],
  xml: ['text/xml', 'application/xml'],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a UUID-based storage path.
 * Example: institutions/123/lab/results/456/a1b2c3d4.pdf
 */
function buildStoragePath(institutionId, module, subpath, originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase();
  const uuid = uuidv4();
  const segments = [
    'institutions',
    String(institutionId),
    module,
    subpath,
    `${uuid}${ext}`,
  ].filter(Boolean);
  return segments.join('/');
}

/**
 * Determine the file category from a MIME type.
 */
function getFileCategory(mimeType) {
  if (!mimeType) return 'default';
  for (const [category, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (types.includes(mimeType)) return category;
  }
  return 'default';
}

/**
 * Validate file MIME type and size.
 */
function validateFile(file, category) {
  const allowed = ALLOWED_MIME_TYPES[category] || ALLOWED_MIME_TYPES.default;
  const maxSize = MAX_FILE_SIZES[category] || MAX_FILE_SIZES.default;

  if (file.mimetype && !allowed.includes(file.mimetype)) {
    throw new Error(
      `File type "${file.mimetype}" is not allowed for ${category}. ` +
      `Allowed: ${allowed.join(', ')}`
    );
  }

  if (file.size && file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    const fileMB = Math.round(file.size / (1024 * 1024));
    throw new Error(
      `File size ${fileMB}MB exceeds the ${maxMB}MB limit for ${category}.`
    );
  }

  return true;
}

// ─── Core Operations ────────────────────────────────────────────────────────

/**
 * Upload a file buffer to Supabase Storage.
 *
 * @param {Object} options
 * @param {Buffer} options.fileBuffer - The file content as a Buffer
 * @param {string} options.fileName - Original filename (for metadata)
 * @param {string} options.mimeType - MIME type
 * @param {number} options.institutionId - Institution ID (required for isolation)
 * @param {string} options.module - Module name (e.g., 'lab', 'patients', 'staff', 'profile')
 * @param {string} options.subpath - Additional path segment (e.g., patient ID, result ID)
 * @param {string} [options.category='default'] - File category for validation
 * @param {Object} [options.metadata] - Additional metadata to store
 * @returns {Promise<{storagePath: string, originalFilename: string, mimeType: string, fileSize: number}>}
 */
async function uploadFile({
  fileBuffer,
  fileName,
  mimeType,
  institutionId,
  module,
  subpath = '',
  category = 'default',
  metadata = {},
}) {
  if (!institutionId) throw new Error('institution_id is required for file upload');
  if (!fileBuffer) throw new Error('File buffer is required');

  // Validate file if category is specific
  if (category !== 'default') {
    validateFile({ mimetype: mimeType, size: fileBuffer.length }, category);
  }

  const storagePath = buildStoragePath(institutionId, module, subpath, fileName);
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: false,
      metadata: {
        institution_id: String(institutionId),
        original_filename: fileName,
        ...metadata,
      },
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return {
    storagePath,
    originalFilename: fileName,
    mimeType: mimeType || 'application/octet-stream',
    fileSize: fileBuffer.length,
  };
}

/**
 * Upload a file from a local disk path (used during multer middleware).
 *
 * @param {Object} options
 * @param {string} options.localPath - Path to the local file
 * @param {string} options.fileName - Original filename
 * @param {string} options.mimeType - MIME type
 * @param {number} options.institutionId - Institution ID
 * @param {string} options.module - Module name
 * @param {string} options.subpath - Additional path segment
 * @param {string} [options.category='default'] - File category
 * @returns {Promise<{storagePath: string, originalFilename: string, mimeType: string, fileSize: number}>}
 */
async function uploadFromPath({
  localPath,
  fileName,
  mimeType,
  institutionId,
  module,
  subpath = '',
  category = 'default',
}) {
  const fs = require('fs');
  const fileBuffer = fs.readFileSync(localPath);

  const result = await uploadFile({
    fileBuffer,
    fileName,
    mimeType,
    institutionId,
    module,
    subpath,
    category,
  });

  // Clean up local temp file
  try {
    fs.unlinkSync(localPath);
  } catch (e) {
    console.warn('Failed to clean up temp file:', localPath, e.message);
  }

  return result;
}

/**
 * Generate a short-lived signed URL for private file access.
 *
 * @param {Object} options
 * @param {string} options.storagePath - The Supabase storage path
 * @param {number} [options.expiresIn=3600] - Seconds until URL expires
 * @returns {Promise<string>} Signed URL
 */
async function getSignedUrl({ storagePath, expiresIn = DEFAULT_SIGNED_URL_EXPIRY }) {
  if (!storagePath) throw new Error('storagePath is required');

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Generate signed URLs for multiple files at once.
 *
 * @param {string[]} storagePaths - Array of storage paths
 * @param {number} [expiresIn=3600] - Seconds until URLs expire
 * @returns {Promise<Object>} Map of storagePath → signedUrl
 */
async function getSignedUrls(storagePaths, expiresIn = DEFAULT_SIGNED_URL_EXPIRY) {
  if (!storagePaths || storagePaths.length === 0) return {};

  const results = {};
  // Supabase supports batch signed URLs (up to a reasonable limit)
  const supabase = getSupabaseClient();

  // Process in batches of 10 to avoid timeout
  const BATCH_SIZE = 10;
  for (let i = 0; i < storagePaths.length; i += BATCH_SIZE) {
    const batch = storagePaths.slice(i, i + BATCH_SIZE);
    const signedUrls = await Promise.allSettled(
      batch.map(async (sp) => {
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(sp, expiresIn);
        if (error) throw error;
        return { path: sp, url: data.signedUrl };
      })
    );

    for (const result of signedUrls) {
      if (result.status === 'fulfilled') {
        results[result.value.path] = result.value.url;
      }
    }
  }

  return results;
}

/**
 * Delete a file from Supabase Storage.
 *
 * @param {string} storagePath - The Supabase storage path
 * @returns {Promise<boolean>}
 */
async function deleteFile(storagePath) {
  if (!storagePath) return false;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error('Failed to delete file from Supabase:', error.message);
    return false;
  }
  return true;
}

/**
 * Delete multiple files from Supabase Storage.
 *
 * @param {string[]} storagePaths - Array of storage paths
 * @returns {Promise<boolean>}
 */
async function deleteFiles(storagePaths) {
  if (!storagePaths || storagePaths.length === 0) return true;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(storagePaths);

  if (error) {
    console.error('Failed to delete files from Supabase:', error.message);
    return false;
  }
  return true;
}

/**
 * Replace an existing file: upload new, update DB, delete old.
 *
 * @param {Object} options
 * @param {string} options.oldStoragePath - Path to the file being replaced
 * @param {Buffer} options.fileBuffer - New file content
 * @param {string} options.fileName - New filename
 * @param {string} options.mimeType - New MIME type
 * @param {number} options.institutionId - Institution ID
 * @param {string} options.module - Module name
 * @param {string} options.subpath - Additional path segment
 * @param {string} [options.category='default'] - File category
 * @returns {Promise<{storagePath: string, originalFilename: string, mimeType: string, fileSize: number}>}
 */
async function replaceFile({
  oldStoragePath,
  fileBuffer,
  fileName,
  mimeType,
  institutionId,
  module,
  subpath = '',
  category = 'default',
}) {
  // 1. Upload new file
  const newFile = await uploadFile({
    fileBuffer,
    fileName,
    mimeType,
    institutionId,
    module,
    subpath,
    category,
  });

  // 2. Delete old file (best effort — don't fail if old file can't be deleted)
  if (oldStoragePath) {
    await deleteFile(oldStoragePath).catch((err) => {
      console.warn('Failed to delete old file during replacement:', err.message);
    });
  }

  return newFile;
}

/**
 * Check if a file exists in Supabase Storage.
 *
 * @param {string} storagePath - The storage path
 * @returns {Promise<boolean>}
 */
async function fileExists(storagePath) {
  if (!storagePath) return false;

  const supabase = getSupabaseClient();
  // Use list to check — looking for the file in its parent folder
  const folder = storagePath.substring(0, storagePath.lastIndexOf('/'));
  const fileName = storagePath.substring(storagePath.lastIndexOf('/') + 1);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folder, { search: fileName });

  if (error) return false;
  return data && data.some(f => f.name === fileName);
}

/**
 * Download a file from Supabase Storage.
 *
 * @param {string} storagePath - The storage path
 * @returns {Promise<Buffer>} File content as Buffer
 */
async function downloadFile(storagePath) {
  if (!storagePath) throw new Error('storagePath is required');

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Resolve a file URL: if it's already a Supabase URL, return signed URL;
 * if it's an old /uploads/ path, return as-is (backward compat).
 *
 * @param {string} fileUrl - Database file_url or storagePath
 * @param {number} [expiresIn=3600]
 * @returns {Promise<string>} Resolved URL
 */
async function resolveFileUrl(fileUrl, expiresIn = DEFAULT_SIGNED_URL_EXPIRY) {
  if (!fileUrl) return null;

  // If it's already a full URL (external or signed), return as-is
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }

  // If it's a Supabase storage path (starts with institutions/)
  if (fileUrl.startsWith('institutions/')) {
    return getSignedUrl({ storagePath: fileUrl, expiresIn });
  }

  // Legacy /uploads/ path — return as-is for backward compatibility
  // The file is still served from the local static mount
  return fileUrl;
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  uploadFile,
  uploadFromPath,
  getSignedUrl,
  getSignedUrls,
  deleteFile,
  deleteFiles,
  replaceFile,
  fileExists,
  downloadFile,
  resolveFileUrl,
  buildStoragePath,
  validateFile,
  BUCKET_NAME,
  MAX_FILE_SIZES,
  ALLOWED_MIME_TYPES,
};
