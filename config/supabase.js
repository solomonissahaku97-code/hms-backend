/**
 * Supabase Client Configuration (Backend)
 *
 * Uses the SERVICE_ROLE_KEY for server-side operations.
 * NEVER expose this key to the frontend via VITE_* or any public variable.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('⚠️  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
  // Don't crash — allow graceful degradation for health checks
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Get the Supabase client. Throws if not configured.
 */
function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabase;
}

/**
 * Ensure the storage bucket exists. Creates it if missing.
 * Called once at startup.
 */
async function ensureBucket() {
  if (!supabase) return;
  const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'hms-storage';
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 20 * 1024 * 1024,
        allowedMimeTypes: [
          'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
          'application/pdf', 'text/xml', 'application/xml',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
      });
      if (error) {
        console.error(`❌ Failed to create Supabase bucket "${BUCKET_NAME}":`, error.message);
      } else {
        console.log(`✅ Created Supabase bucket "${BUCKET_NAME}"`);
      }
    } else {
      console.log(`✅ Supabase bucket "${BUCKET_NAME}" exists`);
    }
  } catch (err) {
    console.error('⚠️  Could not verify Supabase bucket:', err.message);
  }
}

module.exports = { supabase, getSupabaseClient, ensureBucket };
