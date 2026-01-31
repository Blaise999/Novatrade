/**
 * Supabase Client Configuration
 * 
 * This is the main file that connects to Supabase.
 * All other services import from here.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if properly configured
const isConfigured = supabaseUrl.length > 0 && 
                     supabaseAnonKey.length > 0 && 
                     supabaseUrl.includes('supabase.co');

// Log warning if not configured (only in development)
if (!isConfigured && typeof window !== 'undefined') {
  console.warn(
    '⚠️ Supabase not configured. Add to .env.local:\n' +
    '  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
    '  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key'
  );
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key-for-build',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return isConfigured;
};

// Server-side client with service role (for API routes only)
export const createServerSupabaseClient = (): SupabaseClient => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server Supabase client requires SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
