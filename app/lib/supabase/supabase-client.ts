/**
 * Supabase Client Configuration
 * 
 * This is the main file that connects to Supabase.
 * All other services import from here.
 * 
 * IMPORTANT: This uses a "disabled proxy" pattern when Supabase is not configured.
 * This prevents random REST calls with no apikey from being made.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if properly configured (not placeholder values)
const isConfigured = supabaseUrl.length > 20 && 
                     supabaseAnonKey.length > 20 && 
                     supabaseUrl.includes('supabase.co') &&
                     !supabaseUrl.includes('placeholder') &&
                     !supabaseUrl.includes('xxx') &&
                     !supabaseUrl.includes('your-') &&
                     supabaseAnonKey !== 'your-anon-key' &&
                     supabaseAnonKey !== 'somekey';

// Log warning if not configured (only in development, only on client)
if (!isConfigured && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.warn(
    '⚠️ Supabase not configured. Add to .env.local:\n' +
    '  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
    '  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key'
  );
}

/**
 * Creates a "disabled" client that throws helpful errors instead of
 * making network requests that would fail with "No API key found"
 */
function createDisabledClient(message: string): SupabaseClient {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      // Allow checking certain properties without throwing
      if (prop === 'auth') {
        return new Proxy({}, {
          get(_, authProp) {
            if (authProp === 'getSession') {
              return async () => ({ data: { session: null }, error: null });
            }
            if (authProp === 'getUser') {
              return async () => ({ data: { user: null }, error: null });
            }
            if (authProp === 'onAuthStateChange') {
              return () => ({ data: { subscription: { unsubscribe: () => {} } } });
            }
            return () => Promise.resolve({ data: null, error: { message } });
          }
        });
      }
      if (prop === 'from') {
        return () => new Proxy({}, {
          get() {
            return () => Promise.resolve({ data: null, error: { message, code: 'SUPABASE_NOT_CONFIGURED' } });
          }
        });
      }
      if (prop === 'rpc') {
        return () => Promise.resolve({ data: null, error: { message, code: 'SUPABASE_NOT_CONFIGURED' } });
      }
      if (prop === 'channel') {
        return () => ({
          on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
          subscribe: () => ({ unsubscribe: () => {} }),
        });
      }
      if (prop === 'removeChannel') {
        return () => {};
      }
      // For anything else, return a function that rejects
      return () => Promise.reject(new Error(message));
    }
  };
  
  return new Proxy({}, handler) as SupabaseClient;
}

// Create Supabase client - use disabled client if not configured
export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : createDisabledClient(
      'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return isConfigured;
};

// Server-side client with service role (for API routes only)
export const createServerSupabaseClient = (): SupabaseClient => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Server Supabase client requires SUPABASE_SERVICE_ROLE_KEY');
    return createDisabledClient('Server Supabase client requires SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
