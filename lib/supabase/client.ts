// lib/supabase/client.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured =
  supabaseUrl.length > 20 &&
  supabaseAnonKey.length > 20 &&
  supabaseUrl.includes('supabase.co') &&
  !supabaseUrl.includes('your-project');

let supabaseInstance: SupabaseClient | null = null;

const STORAGE_KEY = 'novatrade-sb-auth';
const AUTH_CHANNEL = 'novatrade-auth-sync';

function createMockClient(): SupabaseClient {
  const mockResponse = { data: null, error: null };

  const mockAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: { message: 'Demo mode - Supabase not configured' },
    }),
    signUp: async () => ({
      data: { user: null, session: null },
      error: { message: 'Demo mode - Supabase not configured' },
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (callback: any) => {
      setTimeout(() => callback('INITIAL_SESSION', null), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    setSession: async () => ({ data: { session: null }, error: null }),
  };

  const mockFrom = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => mockResponse,
        single: async () => mockResponse,
      }),
      maybeSingle: async () => mockResponse,
      single: async () => mockResponse,
    }),
    insert: async () => mockResponse,
    upsert: async () => mockResponse,
    update: () => ({
      eq: async () => mockResponse,
    }),
    delete: () => ({
      eq: async () => mockResponse,
    }),
  });

  return {
    auth: mockAuth as any,
    from: mockFrom as any,
    rpc: async () => mockResponse,
  } as unknown as SupabaseClient;
}

function wireCrossTabAuthSync(supabase: SupabaseClient, storageKey: string) {
  const w = window as any;
  if (w.__nt_auth_sync_wired) return;
  w.__nt_auth_sync_wired = true;

  const tabId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // BroadcastChannel (best)
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(AUTH_CHANNEL);
  } catch {
    bc = null;
  }

  const readRaw = () => {
    try {
      return window.sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  };

  const writeRaw = (raw: string) => {
    try {
      window.sessionStorage.setItem(storageKey, raw);
      return true;
    } catch {
      return false;
    }
  };

  const clearRaw = () => {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {}
  };

  const rawToTokens = (
    raw: string
  ): { access_token: string; refresh_token: string } | null => {
    try {
      const parsed = JSON.parse(raw) as any;

      const access =
        parsed?.access_token ??
        parsed?.currentSession?.access_token ??
        parsed?.session?.access_token ??
        parsed?.data?.session?.access_token ??
        null;

      const refresh =
        parsed?.refresh_token ??
        parsed?.currentSession?.refresh_token ??
        parsed?.session?.refresh_token ??
        parsed?.data?.session?.refresh_token ??
        null;

      if (typeof access === 'string' && typeof refresh === 'string') {
        return { access_token: access, refresh_token: refresh };
      }
      return null;
    } catch {
      return null;
    }
  };

  const send = (msg: any) => {
    const payload = { ...msg, __tabId: tabId };

    if (bc) {
      bc.postMessage(payload);
      return;
    }

    // Fallback: localStorage event bus (messages only)
    try {
      localStorage.setItem('__nt_auth_msg__', JSON.stringify({ ...payload, __t: Date.now() }));
      localStorage.removeItem('__nt_auth_msg__');
    } catch {}
  };

  const handleMessage = async (data: any) => {
    if (!data || data.__tabId === tabId) return;

    if (data.type === 'REQUEST_SESSION') {
      const raw = readRaw();
      if (raw) send({ type: 'SESSION', raw });
      return;
    }

    if (data.type === 'SESSION') {
      const have = readRaw();
      if (!have && typeof data.raw === 'string' && data.raw.length > 20) {
        writeRaw(data.raw);

        const tokens = rawToTokens(data.raw);
        if (tokens) {
          try {
            await supabase.auth.setSession(tokens);
          } catch {
            // ignore
          }
        }
      }
      return;
    }

    if (data.type === 'SIGNED_OUT') {
      clearRaw();
      try {
        await supabase.auth.signOut();
      } catch {}
      return;
    }
  };

  if (bc) {
    bc.onmessage = (ev) => handleMessage(ev.data);
  } else {
    window.addEventListener('storage', (ev) => {
      if (ev.key !== '__nt_auth_msg__' || !ev.newValue) return;
      try {
        handleMessage(JSON.parse(ev.newValue));
      } catch {}
    });
  }

  if (!readRaw()) send({ type: 'REQUEST_SESSION' });

  supabase.auth.onAuthStateChange((_event, session) => {
    const raw = readRaw();
    if (session && raw) send({ type: 'SESSION', raw });
    else send({ type: 'SIGNED_OUT' });
  });
}

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  if (!isConfigured) {
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

      // ✅ per-tab storage
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      storageKey: STORAGE_KEY,
    },
  });

  if (typeof window !== 'undefined') {
    wireCrossTabAuthSync(supabaseInstance, STORAGE_KEY);
  }

  return supabaseInstance;
}

// Export singleton instance
export const supabase = getSupabaseClient();
export const isSupabaseConfigured = () => isConfigured;

// Server client (service role)
export function createServerClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Server client requires SUPABASE_SERVICE_ROLE_KEY');
    return createMockClient();
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
