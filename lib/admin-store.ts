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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
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

// Admin credentials (in production, this would be in a secure backend)
const ADMIN_CREDENTIALS = [
  { email: 'admin@novatrade.com', password: 'admin123', name: 'Super Admin', role: 'super_admin' as const },
  { email: 'signal@novatrade.com', password: 'signal123', name: 'Signal Provider', role: 'signal_provider' as const },
];

export const useAdminAuthStore = create<AdminAuthStore>()(
  persist(
    (set) => ({
      admin: null,
      isAuthenticated: false,
      
      login: async (email: string, password: string) => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const admin = ADMIN_CREDENTIALS.find(
          a => a.email === email && a.password === password
        );
        
        if (admin) {
          const adminUser: AdminUser = {
            id: `admin_${Date.now()}`,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            createdAt: new Date(),
            lastLogin: new Date(),
          };
          set({ admin: adminUser, isAuthenticated: true });
          return true;
        }
        return false;
      },
      
      logout: () => {
        set({ admin: null, isAuthenticated: false });
      },
    }),
    {
      name: 'novatrade-admin-auth',
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
