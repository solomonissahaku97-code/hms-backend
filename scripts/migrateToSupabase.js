#!/usr/bin/env node
/**
 * Migration Script: Local Files → Supabase Storage
 *
 * This script:
 * 1. Scans the uploads/ directory for existing files
 * 2. Uploads them to the appropriate Supabase Storage path
 * 3. Does NOT delete local files (preserves them as backup)
 * 4. Logs what was migrated and what was skipped
 *
 * Run AFTER setting SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Usage: node scripts/migrateToSupabase.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { getSupabaseClient, supabase } = require('../config/supabase');
const { BUCKET_NAME } = require('../service/storageService');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const DRY_RUN = process.argv.includes('--dry-run');

// Track statistics
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

/**
 * Recursively scan a directory for files.
 */
function scanDirectory(dir, prefix = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      results.push(...scanDirectory(fullPath, relativePath));
    } else {
      results.push({ fullPath, relativePath });
    }
  }
  return results;
}

/**
 * Determine the Supabase storage path for a file based on its location.
 */
function mapToSupabasePath(relativePath) {
  const parts = relativePath.split('/');
  const filename = parts[parts.length - 1];
  const ext = path.extname(filename);
  const uuid = uuidv4();

  // Default: institutions/1/uploads/{uuid}{ext}
  // You may want to refine this based on actual DB records
  return `institutions/1/uploads/${uuid}${ext}`;
}

/**
 * Upload a single file to Supabase Storage.
 */
async function migrateFile(fullPath, relativePath) {
  stats.total++;

  try {
    const fileBuffer = fs.readFileSync(fullPath);
    const filename = path.basename(fullPath);
    const mimeType = getMimeType(filename);

    const storagePath = mapToSupabasePath(relativePath);

    if (DRY_RUN) {
      console.log(`[DRY RUN] Would upload: ${relativePath} → ${storagePath}`);
      stats.migrated++;
      return;
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      if (error.message.includes('already exists')) {
        stats.skipped++;
      } else {
        stats.failed++;
        stats.errors.push({ file: relativePath, error: error.message });
        console.error(`❌ Failed: ${relativePath} — ${error.message}`);
      }
    } else {
      stats.migrated++;
      console.log(`✅ Migrated: ${relativePath} → ${storagePath}`);
    }
  } catch (err) {
    stats.failed++;
    stats.errors.push({ file: relativePath, error: err.message });
    console.error(`❌ Error: ${relativePath} — ${err.message}`);
  }
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.xml': 'application/xml',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Tonitel HMS — Local → Supabase Migration Script');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no files will be uploaded)' : 'LIVE'}`);
  console.log(`Source: ${UPLOADS_DIR}`);
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log('');

  if (!supabase) {
    console.error('❌ Supabase client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  // Ensure bucket exists
  if (!DRY_RUN) {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
    if (!bucketExists) {
      console.log(`Creating bucket: ${BUCKET_NAME}...`);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 20 * 1024 * 1024, // 20MB
        allowedMimeTypes: [
          'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
          'application/pdf', 'text/xml', 'application/xml',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
      });
      if (error) {
        console.error(`❌ Failed to create bucket: ${error.message}`);
        process.exit(1);
      }
      console.log(`✅ Bucket "${BUCKET_NAME}" created successfully.`);
    } else {
      console.log(`✅ Bucket "${BUCKET_NAME}" already exists.`);
    }
  }

  // Scan for files
  console.log('\nScanning uploads directory...');
  const files = scanDirectory(UPLOADS_DIR);
  console.log(`Found ${files.length} files.\n`);

  // Filter out temp files
  const filesToMigrate = files.filter(f => !f.relativePath.startsWith('temp/'));
  console.log(`Files to migrate (excluding temp): ${filesToMigrate.length}\n`);

  // Migrate
  for (const file of filesToMigrate) {
    await migrateFile(file.fullPath, file.relativePath);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Migration Summary');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Total files:     ${stats.total}`);
  console.log(`  Migrated:        ${stats.migrated}`);
  console.log(`  Skipped:         ${stats.skipped}`);
  console.log(`  Failed:          ${stats.failed}`);
  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
  }
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
