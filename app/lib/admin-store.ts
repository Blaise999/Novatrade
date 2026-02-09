'use client';

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import {
  AdminUser,
  TradingSession,
  TradeSignal,
  SessionTemplate,
  generateTimeSlots,
} from './admin-types';

type AdminUserWithToken = AdminUser & { token?: string };

interface AdminAuthStore {
  admin: AdminUserWithToken | null;
  isAuthenticated: boolean;
  sessionToken: string | null;

  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  verifySession: () => Promise<boolean>;
 getAuthHeader: () => Record<string, string>;
}

interface AdminSessionStore {
  sessions: TradingSession[];
  activeSession: TradingSession | null;
  templates: SessionTemplate[];

  createSession: (session: Omit<TradingSession, 'id' | 'createdAt' | 'signals'>) => TradingSession;
  updateSession: (id: string, updates: Partial<TradingSession>) => void;
  deleteSession: (id: string) => void;
  activateSession: (id: string) => void;
  completeSession: (id: string) => void;

  addSignal: (sessionId: string, signal: Omit<TradeSignal, 'id' | 'createdAt'>) => void;
  updateSignal: (sessionId: string, signalId: string, updates: Partial<TradeSignal>) => void;
  removeSignal: (sessionId: string, signalId: string) => void;
  bulkAddSignals: (sessionId: string, signals: Array<{ startTime: Date; direction: 'up' | 'down' }>) => void;

  createQuickSession: (
    assetId: string,
    assetSymbol: string,
    assetName: string,
    startTime: Date,
    durationMinutes: number,
    tradeDurationSeconds: number,
    adminId: string
  ) => TradingSession;

  getCurrentSignal: (assetId: string, time?: Date) => TradeSignal | null;

  saveTemplate: (template: Omit<SessionTemplate, 'id'>) => void;
  deleteTemplate: (id: string) => void;
}

// ============================================
// STORAGE: sessionStorage-first + migrate from localStorage
// ============================================

const ADMIN_TOKEN_KEY = 'novatrade_admin_token';
const LEGACY_TOKEN_KEYS = ['admin_token', 'novatrade-admin-token', 'novatrade_admin_token'];

function safeSession(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}
function safeLocal(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// Migrate old standalone token keys -> sessionStorage
(function migrateLegacyTokenKeysOnce() {
  const ss = safeSession();
  const ls = safeLocal();
  if (!ss || !ls) return;

  // If new key already exists, we're good.
  if (ss.getItem(ADMIN_TOKEN_KEY)) {
    // cleanup obvious legacy keys if present
    for (const k of LEGACY_TOKEN_KEYS) {
      if (k !== ADMIN_TOKEN_KEY) ls.removeItem(k);
    }
    return;
  }

  // Find token in any legacy key (prefer localStorage)
  for (const k of LEGACY_TOKEN_KEYS) {
    const v = ls.getItem(k);
    if (v) {
      ss.setItem(ADMIN_TOKEN_KEY, v);
      ls.removeItem(k);
      break;
    }
  }
})();

function sessionFirstStorage(): StateStorage {
  return {
    getItem: (name) => {
      const ss = safeSession();
      const ls = safeLocal();

      const fromSession = ss?.getItem(name);
      if (fromSession != null) return fromSession;

      // Migrate persisted zustand state from localStorage -> sessionStorage
      const fromLocal = ls?.getItem(name);
      if (fromLocal != null && ss) {
        ss.setItem(name, fromLocal);
        ls?.removeItem(name);
        return fromLocal;
      }

      return null;
    },
    setItem: (name, value) => {
      const ss = safeSession();
      ss?.setItem(name, value);
    },
    removeItem: (name) => {
      const ss = safeSession();
      const ls = safeLocal();
      ss?.removeItem(name);
      // also remove old copies if any
      ls?.removeItem(name);
    },
  };
}

function writeAdminToken(token: string | null) {
  const ss = safeSession();
  if (!ss) return;

  if (!token) {
    ss.removeItem(ADMIN_TOKEN_KEY);
    return;
  }
  ss.setItem(ADMIN_TOKEN_KEY, token);
}

function readAdminToken(): string | null {
  const ss = safeSession();
  const ls = safeLocal();

  const s = ss?.getItem(ADMIN_TOKEN_KEY);
  if (s) return s;

  // fallback legacy keys in localStorage (migrate)
  for (const k of LEGACY_TOKEN_KEYS) {
    const v = ls?.getItem(k);
    if (v) {
      writeAdminToken(v);
      ls?.removeItem(k);
      return v;
    }
  }
  return null;
}

// ============================================
// ADMIN AUTH STORE (sessionStorage persistence)
// ============================================

export const useAdminAuthStore = create<AdminAuthStore>()(
  persist(
    (set, get) => ({
      admin: null,
      isAuthenticated: false,
      sessionToken: null,

      login: async (email: string, password: string) => {
        try {
          const response = await fetch('/api/admin/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const data = await response.json().catch(() => ({} as any));

          if (!response.ok || !data?.success) {
            return { success: false, error: data?.error || 'Invalid credentials' };
          }

          const token: string = data.sessionToken;
          if (!token) return { success: false, error: 'Missing session token from server' };

          const adminUser: AdminUserWithToken = {
            id: data.admin.id,
            email: data.admin.email,
            name: data.admin.name || data.admin.first_name || 'Admin',
            role: data.admin.role as any,
            createdAt: new Date(data.admin.created_at || Date.now()),
            lastLogin: new Date(),
            // ✅ backward-compat: some pages try admin.token
            token,
          };

          writeAdminToken(token);

          set({
            admin: adminUser,
            isAuthenticated: true,
            sessionToken: token,
          });

          return { success: true };
        } catch (error: any) {
          return { success: false, error: error?.message || 'Login failed' };
        }
      },

      logout: async () => {
        const token = get().sessionToken || readAdminToken();

        if (token) {
          try {
            await fetch('/api/admin/auth/logout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });
          } catch {
            // ignore
          }
        }

        writeAdminToken(null);

        set({ admin: null, isAuthenticated: false, sessionToken: null });
      },

      verifySession: async () => {
        const token = get().sessionToken || readAdminToken();
        if (!token) {
          set({ admin: null, isAuthenticated: false, sessionToken: null });
          return false;
        }

        try {
          const response = await fetch('/api/admin/auth/verify', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });

          if (!response.ok) {
            writeAdminToken(null);
            set({ admin: null, isAuthenticated: false, sessionToken: null });
            return false;
          }

          // Keep store + sessionStorage consistent
          const admin = get().admin;
          if (admin && admin.token !== token) {
            set({ admin: { ...admin, token }, sessionToken: token, isAuthenticated: true });
          } else {
            set({ sessionToken: token, isAuthenticated: true });
          }

          writeAdminToken(token);
          return true;
        } catch {
          return false;
        }
      },

 getAuthHeader: () => {
  const token = get().sessionToken || readAdminToken();

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
},

    }),
    {
      name: 'novatrade-admin-auth',
      storage: createJSONStorage(sessionFirstStorage),
      partialize: (state) => ({
        admin: state.admin,
        isAuthenticated: state.isAuthenticated,
        sessionToken: state.sessionToken,
      }),
      // Auto-verify after rehydrate (prevents “logged in but token invalid”)
      onRehydrateStorage: () => (state) => {
        try {
          const token = readAdminToken();
          if (token && state) {
            // ensure store has token even if state lost it
            if (!state.sessionToken) {
              state.sessionToken = token;
            }
            // fire-and-forget verification
            void useAdminAuthStore.getState().verifySession();
          }
        } catch {
          // ignore
        }
      },
    }
  )
);

// ============================================
// ADMIN SESSION STORE (kept as-is, but persisted in sessionStorage too)
// ============================================

export const useAdminSessionStore = create<AdminSessionStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSession: null,
      templates: [
        {
          id: 'template_1',
          name: '5-Minute Quick Session',
          assetId: 'eurusd',
          assetSymbol: 'EUR/USD',
          durationMinutes: 55,
          tradeDurationSeconds: 300,
          defaultSignals: [
            { minuteOffset: 0, direction: 'up' },
            { minuteOffset: 5, direction: 'down' },
            { minuteOffset: 10, direction: 'up' },
            { minuteOffset: 15, direction: 'up' },
            { minuteOffset: 20, direction: 'down' },
            { minuteOffset: 25, direction: 'up' },
            { minuteOffset: 30, direction: 'down' },
            { minuteOffset: 35, direction: 'down' },
            { minuteOffset: 40, direction: 'up' },
            { minuteOffset: 45, direction: 'down' },
            { minuteOffset: 50, direction: 'up' },
          ],
        },
      ],

      createSession: (sessionData) => {
        const session: TradingSession = {
          ...sessionData,
          id: `session_${Date.now()}`,
          signals: [],
          createdAt: new Date(),
        };

        set((state) => ({ sessions: [...state.sessions, session] }));
        return session;
      },

      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
          activeSession:
            state.activeSession?.id === id ? { ...state.activeSession, ...updates } : state.activeSession,
        }));
      },

      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSession: state.activeSession?.id === id ? null : state.activeSession,
        }));
      },

      activateSession: (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return;

        set((state) => ({
          sessions: state.sessions.map((s) => ({
            ...s,
            status: s.id === id ? 'active' : s.status === 'active' ? 'completed' : s.status,
          })),
          activeSession: { ...session, status: 'active' },
        }));
      },

      completeSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, status: 'completed' } : s)),
          activeSession: state.activeSession?.id === id ? null : state.activeSession,
        }));
      },

      addSignal: (sessionId, signalData) => {
        const signal: TradeSignal = {
          ...signalData,
          id: `signal_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          createdAt: new Date(),
        };

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, signals: [...s.signals, signal].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()) }
              : s
          ),
          activeSession:
            state.activeSession?.id === sessionId
              ? {
                  ...state.activeSession,
                  signals: [...state.activeSession.signals, signal].sort(
                    (a, b) => a.startTime.getTime() - b.startTime.getTime()
                  ),
                }
              : state.activeSession,
        }));
      },

      updateSignal: (sessionId, signalId, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, signals: s.signals.map((sig) => (sig.id === signalId ? { ...sig, ...updates } : sig)) } : s
          ),
          activeSession:
            state.activeSession?.id === sessionId
              ? { ...state.activeSession, signals: state.activeSession.signals.map((sig) => (sig.id === signalId ? { ...sig, ...updates } : sig)) }
              : state.activeSession,
        }));
      },

      removeSignal: (sessionId, signalId) => {
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, signals: s.signals.filter((sig) => sig.id !== signalId) } : s)),
          activeSession:
            state.activeSession?.id === sessionId
              ? { ...state.activeSession, signals: state.activeSession.signals.filter((sig) => sig.id !== signalId) }
              : state.activeSession,
        }));
      },

      bulkAddSignals: (sessionId, signals) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return;

        const newSignals: TradeSignal[] = signals.map((sig, index) => ({
          id: `signal_${Date.now()}_${index}`,
          assetId: session.assetId,
          assetSymbol: session.assetSymbol,
          assetName: session.assetSymbol,
          direction: sig.direction,
          startTime: sig.startTime,
          endTime: new Date(sig.startTime.getTime() + 300_000),
          duration: 300,
          status: 'scheduled',
          createdBy: session.createdBy,
          createdAt: new Date(),
        }));

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, signals: [...s.signals, ...newSignals].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()) } : s
          ),
        }));
      },

      createQuickSession: (assetId, assetSymbol, assetName, startTime, durationMinutes, tradeDurationSeconds, adminId) => {
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        const slots = generateTimeSlots(startTime, endTime, tradeDurationSeconds);

        const session: TradingSession = {
          id: `session_${Date.now()}`,
          name: `${assetSymbol} Trading Session`,
          assetId,
          assetSymbol,
          startTime,
          endTime,
          signals: slots.map((slot, index) => ({
            id: `signal_${Date.now()}_${index}`,
            assetId,
            assetSymbol,
            assetName,
            direction: 'up',
            startTime: slot.start,
            endTime: slot.end,
            duration: tradeDurationSeconds,
            status: 'scheduled',
            createdBy: adminId,
            createdAt: new Date(),
          })),
          status: 'draft',
          createdBy: adminId,
          createdAt: new Date(),
        };

        set((state) => ({ sessions: [...state.sessions, session] }));
        return session;
      },

      getCurrentSignal: (assetId, time = new Date()) => {
        const { activeSession } = get();
        if (!activeSession || activeSession.assetId !== assetId) return null;

        const now = time.getTime();
        return (
          activeSession.signals.find((signal) => {
            const start = new Date(signal.startTime).getTime();
            const end = new Date(signal.endTime).getTime();
            return now >= start && now < end;
          }) || null
        );
      },

      saveTemplate: (template) => {
        const newTemplate: SessionTemplate = { ...template, id: `template_${Date.now()}` };
        set((state) => ({ templates: [...state.templates, newTemplate] }));
      },

      deleteTemplate: (id) => {
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
      },
    }),
    {
      name: 'novatrade-admin-sessions',
      storage: createJSONStorage(sessionFirstStorage),
      partialize: (state) => ({ sessions: state.sessions, templates: state.templates }),
    }
  )
);
