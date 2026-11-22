import { createClient } from '@supabase/supabase-js';

// Environment parameters for Supabase with production defaults for Bazaar-Guru
const DEFAULT_SUPABASE_URL = 'https://lftbzabnaxvnhbamyhot.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdGJ6YWJuYXh2bmhiYW15aG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzMzMwMDcsImV4cCI6MjExMDkwOTAwN30.5UwIac8Qb9u1ZMUcj3Y0zzFQVSxKZiU_LG3o53EQNe8';

const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

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
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdGJ6YWJuYXh2bmhiYW15aG90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTMzMzAwNywiZXhwIjoyMTEwOTA5MDA3fQ.aRriwt_5sPjI0R8wXXRPdGJYZZj3qmlx0i_aUkARtto';
  const adminUrl = process.env.SUPABASE_URL || supabaseUrl;
  return createClient(adminUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
