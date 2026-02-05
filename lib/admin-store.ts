import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  AdminUser, 
  TradingSession, 
  TradeSignal, 
  SessionTemplate,
  generateTimeSlots 
} from './admin-types';

interface AdminAuthStore {
  admin: AdminUser | null;
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
  
  // Session management
  createSession: (session: Omit<TradingSession, 'id' | 'createdAt' | 'signals'>) => TradingSession;
  updateSession: (id: string, updates: Partial<TradingSession>) => void;
  deleteSession: (id: string) => void;
  activateSession: (id: string) => void;
  completeSession: (id: string) => void;
  
  // Signal management
  addSignal: (sessionId: string, signal: Omit<TradeSignal, 'id' | 'createdAt'>) => void;
  updateSignal: (sessionId: string, signalId: string, updates: Partial<TradeSignal>) => void;
  removeSignal: (sessionId: string, signalId: string) => void;
  bulkAddSignals: (sessionId: string, signals: Array<{ startTime: Date; direction: 'up' | 'down' }>) => void;
  
  // Quick session creation
  createQuickSession: (
    assetId: string,
    assetSymbol: string,
    assetName: string,
    startTime: Date,
    durationMinutes: number,
    tradeDurationSeconds: number,
    adminId: string
  ) => TradingSession;
  
  // Get current signal for a given time and asset
  getCurrentSignal: (assetId: string, time?: Date) => TradeSignal | null;
  
  // Templates
  saveTemplate: (template: Omit<SessionTemplate, 'id'>) => void;
  deleteTemplate: (id: string) => void;
}

// ============================================
// SECURE ADMIN AUTHENTICATION
// Authenticates against Supabase - NO hardcoded credentials
// ============================================

export const useAdminAuthStore = create<AdminAuthStore>()(
  persist(
    (set, get) => ({
      admin: null,
      isAuthenticated: false,
      sessionToken: null,
      
      login: async (email: string, password: string) => {
        try {
          // Call secure server-side API for admin authentication
          const response = await fetch('/api/admin/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          
          const data = await response.json();
          
          if (!response.ok || !data.success) {
            console.error('Admin login failed:', data.error);
            return { success: false, error: data.error || 'Invalid credentials' };
          }
          
          const adminUser: AdminUser = {
            id: data.admin.id,
            email: data.admin.email,
            name: data.admin.name || data.admin.first_name || 'Admin',
            role: data.admin.role as 'super_admin' | 'signal_provider',
            createdAt: new Date(data.admin.created_at),
            lastLogin: new Date(),
          };
          
          set({ 
            admin: adminUser, 
            isAuthenticated: true,
            sessionToken: data.sessionToken,
          });
          
          return { success: true };
        } catch (error: any) {
          console.error('Admin login error:', error);
          return { success: false, error: error.message || 'Login failed' };
        }
      },
      
      logout: async () => {
        const { sessionToken } = get();
        
        // Revoke session on server
        if (sessionToken) {
          try {
            await fetch('/api/admin/auth/logout', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`,
              },
            });
          } catch (error) {
            console.error('Logout error:', error);
          }
        }
        
        set({ admin: null, isAuthenticated: false, sessionToken: null });
      },
      
      // Verify session is still valid
      verifySession: async () => {
        const { sessionToken } = get();
        if (!sessionToken) {
          set({ admin: null, isAuthenticated: false });
          return false;
        }
        
        try {
          const response = await fetch('/api/admin/auth/verify', {
            headers: { 'Authorization': `Bearer ${sessionToken}` },
          });
          
          if (!response.ok) {
            set({ admin: null, isAuthenticated: false, sessionToken: null });
            return false;
          }
          
          return true;
        } catch {
          return false;
        }
      },
      
      getAuthHeader: (): Record<string, string> => {
        const { sessionToken } = get();
        const headers: Record<string, string> = {};
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }
        return headers;
      },
    }),
    {
      name: 'novatrade-admin-auth',
      partialize: (state) => ({
        admin: state.admin,
        isAuthenticated: state.isAuthenticated,
        sessionToken: state.sessionToken,
      }),
    }
  )
);

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
        
        set(state => ({
          sessions: [...state.sessions, session],
        }));
        
        return session;
      },
      
      updateSession: (id, updates) => {
        set(state => ({
          sessions: state.sessions.map(s => 
            s.id === id ? { ...s, ...updates } : s
          ),
          activeSession: state.activeSession?.id === id 
            ? { ...state.activeSession, ...updates } 
            : state.activeSession,
        }));
      },
      
      deleteSession: (id) => {
        set(state => ({
          sessions: state.sessions.filter(s => s.id !== id),
          activeSession: state.activeSession?.id === id ? null : state.activeSession,
        }));
      },
      
      activateSession: (id) => {
        const session = get().sessions.find(s => s.id === id);
        if (session) {
          set(state => ({
            sessions: state.sessions.map(s => ({
              ...s,
              status: s.id === id ? 'active' : (s.status === 'active' ? 'completed' : s.status),
            })),
            activeSession: { ...session, status: 'active' },
          }));
        }
      },
      
      completeSession: (id) => {
        set(state => ({
          sessions: state.sessions.map(s => 
            s.id === id ? { ...s, status: 'completed' } : s
          ),
          activeSession: state.activeSession?.id === id ? null : state.activeSession,
        }));
      },
      
      addSignal: (sessionId, signalData) => {
        const signal: TradeSignal = {
          ...signalData,
          id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
        };
        
        set(state => ({
          sessions: state.sessions.map(s => 
            s.id === sessionId 
              ? { ...s, signals: [...s.signals, signal].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()) }
              : s
          ),
          activeSession: state.activeSession?.id === sessionId
            ? { ...state.activeSession, signals: [...state.activeSession.signals, signal].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()) }
            : state.activeSession,
        }));
      },
      
      updateSignal: (sessionId, signalId, updates) => {
        set(state => ({
          sessions: state.sessions.map(s => 
            s.id === sessionId 
              ? { 
                  ...s, 
                  signals: s.signals.map(sig => 
                    sig.id === signalId ? { ...sig, ...updates } : sig
                  )
                }
              : s
          ),
          activeSession: state.activeSession?.id === sessionId
            ? {
                ...state.activeSession,
                signals: state.activeSession.signals.map(sig =>
                  sig.id === signalId ? { ...sig, ...updates } : sig
                )
              }
            : state.activeSession,
        }));
      },
      
      removeSignal: (sessionId, signalId) => {
        set(state => ({
          sessions: state.sessions.map(s => 
            s.id === sessionId 
              ? { ...s, signals: s.signals.filter(sig => sig.id !== signalId) }
              : s
          ),
          activeSession: state.activeSession?.id === sessionId
            ? { ...state.activeSession, signals: state.activeSession.signals.filter(sig => sig.id !== signalId) }
            : state.activeSession,
        }));
      },
      
      bulkAddSignals: (sessionId, signals) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session) return;
        
        const newSignals: TradeSignal[] = signals.map((sig, index) => ({
          id: `signal_${Date.now()}_${index}`,
          assetId: session.assetId,
          assetSymbol: session.assetSymbol,
          assetName: session.assetSymbol,
          direction: sig.direction,
          startTime: sig.startTime,
          endTime: new Date(sig.startTime.getTime() + 300000), // 5 min default
          duration: 300,
          status: 'scheduled' as const,
          createdBy: session.createdBy,
          createdAt: new Date(),
        }));
        
        set(state => ({
          sessions: state.sessions.map(s => 
            s.id === sessionId 
              ? { ...s, signals: [...s.signals, ...newSignals].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()) }
              : s
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
            direction: 'up' as const, // Default, admin will change
            startTime: slot.start,
            endTime: slot.end,
            duration: tradeDurationSeconds,
            status: 'scheduled' as const,
            createdBy: adminId,
            createdAt: new Date(),
          })),
          status: 'draft',
          createdBy: adminId,
          createdAt: new Date(),
        };
        
        set(state => ({
          sessions: [...state.sessions, session],
        }));
        
        return session;
      },
      
      getCurrentSignal: (assetId, time = new Date()) => {
        const { activeSession } = get();
        if (!activeSession || activeSession.assetId !== assetId) return null;
        
        const currentSignal = activeSession.signals.find(signal => {
          const start = new Date(signal.startTime).getTime();
          const end = new Date(signal.endTime).getTime();
          const now = time.getTime();
          return now >= start && now < end;
        });
        
        return currentSignal || null;
      },
      
      saveTemplate: (template) => {
        const newTemplate: SessionTemplate = {
          ...template,
          id: `template_${Date.now()}`,
        };
        set(state => ({
          templates: [...state.templates, newTemplate],
        }));
      },
      
      deleteTemplate: (id) => {
        set(state => ({
          templates: state.templates.filter(t => t.id !== id),
        }));
      },
    }),
    {
      name: 'novatrade-admin-sessions',
      partialize: (state) => ({
        sessions: state.sessions,
        templates: state.templates,
      }),
    }
  )
);
