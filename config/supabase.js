/**
 * Supabase Client Configuration (Backend)
 *
 * Uses the SERVICE_ROLE_KEY for server-side operations.
 * NEVER expose this key to the frontend via VITE_* or any public variable.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

module.exports = { supabase, getSupabaseClient };
