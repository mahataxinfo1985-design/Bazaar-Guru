import { createClient } from '@supabase/supabase-js';

// Environment parameters for Supabase
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Bazaar-Guru: Supabase URL or Anon key is missing. Check your environment parameters.');
}

/**
 * Client-side Supabase client for browser authentication and authorized queries
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/**
 * Server-side privileged client using Service Role Key
 * ONLY initialized when running in Node.js server environments. Never exposed to browser.
 */
export function getSupabaseAdmin() {
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminUrl = process.env.SUPABASE_URL || supabaseUrl;
  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is not defined in server environment');
  }
  return createClient(adminUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
