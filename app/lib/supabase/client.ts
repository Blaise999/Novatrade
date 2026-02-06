/**
 * SUPABASE CLIENT - SINGLE INSTANCE
 * 
 * This is the ONLY place where the Supabase client should be created.
 * All other files should import from here.
 * 
 * DO NOT create new createClient() calls anywhere else!
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if properly configured
const isConfigured = 
  supabaseUrl.length > 20 && 
  supabaseAnonKey.length > 20 && 
  supabaseUrl.includes('supabase.co') &&
  !supabaseUrl.includes('your-project');

// Singleton pattern - only create client once
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!isConfigured) {
    // Return a mock client for demo mode
    console.warn('⚠️ Supabase not configured - running in demo mode');
    supabaseInstance = createMockClient();
    return supabaseInstance;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

  return supabaseInstance;
}

/**
 * Creates a mock client for demo mode that doesn't make real requests
 */
function createMockClient(): SupabaseClient {
  const mockResponse = { data: null, error: null };
  
  const mockAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Demo mode - use localStorage' } }),
    signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Demo mode - use localStorage' } }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (callback: any) => {
      // Call with null session immediately
      setTimeout(() => callback('INITIAL_SESSION', null), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  };

  const mockFrom = () => ({
    select: () => ({ 
      eq: () => ({ 
        maybeSingle: async () => mockResponse,
        single: async () => mockResponse,
        order: () => ({ data: [], error: null }),
      }),
      order: () => ({ data: [], error: null }),
    }),
    insert: () => ({ 
      select: () => ({ 
        single: async () => mockResponse,
      }),
    }),
    update: () => ({ 
      eq: () => mockResponse,
    }),
    delete: () => ({ 
      eq: () => mockResponse,
    }),
  });

  return {
    auth: mockAuth,
    from: mockFrom,
    rpc: async () => mockResponse,
  } as unknown as SupabaseClient;
}

// Export the singleton instance
export const supabase = getSupabaseClient();

// Export helper to check if configured
export const isSupabaseConfigured = () => isConfigured;

// Export for server-side use (API routes)
export function createServerClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Server client requires SUPABASE_SERVICE_ROLE_KEY');
    return createMockClient();
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
