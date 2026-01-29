import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  User, 
  Trade, 
  Position, 
  MarketAsset, 
  Notification, 
  KYCData,
  UserSettings,
  AccountBalance
} from './types';

// Auth Store
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  otpEmail: string | null;
  otpName: string | null;
  redirectUrl: string | null;
  setUser: (user: User | null) => void;
  setOtpEmail: (email: string | null) => void;
  setOtpName: (name: string | null) => void;
  setRedirectUrl: (url: string | null) => void;
  logout: () => void;
  updateBalance: (balance: Partial<AccountBalance>) => void;
  updateKYC: (status: User['kycStatus'], level: User['kycLevel']) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      otpEmail: null,
      otpName: null,
      redirectUrl: null,
      setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
      setOtpEmail: (email) => set({ otpEmail: email }),
      setOtpName: (name) => set({ otpName: name }),
      setRedirectUrl: (url) => set({ redirectUrl: url }),
      logout: () => set({ user: null, isAuthenticated: false, otpEmail: null, otpName: null, redirectUrl: null }),
      updateBalance: (balance) => set((state) => ({
        user: state.user ? {
          ...state.user,
          balance: { ...state.user.balance, ...balance }
        } : null
      })),
      updateKYC: (status, level) => set((state) => ({
        user: state.user ? {
          ...state.user,
          kycStatus: status,
          kycLevel: level
        } : null
      }))
    }),
    {
      name: 'novatrade-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated, redirectUrl: state.redirectUrl })
    }
  )
);

// Trading Store
interface TradingState {
  selectedAsset: MarketAsset | null;
  assets: MarketAsset[];
  activeTrades: Trade[];
  positions: Position[];
  tradeHistory: Trade[];
  selectedTimeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
  tradeAmount: number;
  tradeDuration: number;
  setSelectedAsset: (asset: MarketAsset | null) => void;
  setAssets: (assets: MarketAsset[]) => void;
  addTrade: (trade: Trade) => void;
  updateTrade: (tradeId: string, updates: Partial<Trade>) => void;
  closeTrade: (tradeId: string, exitPrice: number, profit: number) => void;
  setTimeframe: (tf: TradingState['selectedTimeframe']) => void;
  setTradeAmount: (amount: number) => void;
  setTradeDuration: (duration: number) => void;
  addPosition: (position: Position) => void;
  updatePosition: (positionId: string, updates: Partial<Position>) => void;
  closePosition: (positionId: string) => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  selectedAsset: null,
  assets: [],
  activeTrades: [],
  positions: [],
  tradeHistory: [],
  selectedTimeframe: '1m',
  tradeAmount: 100,
  tradeDuration: 60,
  setSelectedAsset: (asset) => set({ selectedAsset: asset }),
  setAssets: (assets) => set({ assets }),
  addTrade: (trade) => set((state) => ({ 
    activeTrades: [...state.activeTrades, trade] 
  })),
  updateTrade: (tradeId, updates) => set((state) => ({
    activeTrades: state.activeTrades.map((t) =>
      t.id === tradeId ? { ...t, ...updates } : t
    )
  })),
  closeTrade: (tradeId, exitPrice, profit) => set((state) => {
    const trade = state.activeTrades.find((t) => t.id === tradeId);
    if (!trade) return state;
    
    const closedTrade: Trade = {
      ...trade,
      exitPrice,
      profit,
      status: profit > 0 ? 'won' : 'lost',
      closedAt: new Date()
    };
    
    return {
      activeTrades: state.activeTrades.filter((t) => t.id !== tradeId),
      tradeHistory: [closedTrade, ...state.tradeHistory]
    };
  }),
  setTimeframe: (tf) => set({ selectedTimeframe: tf }),
  setTradeAmount: (amount) => set({ tradeAmount: amount }),
  setTradeDuration: (duration) => set({ tradeDuration: duration }),
  addPosition: (position) => set((state) => ({
    positions: [...state.positions, position]
  })),
  updatePosition: (positionId, updates) => set((state) => ({
    positions: state.positions.map((p) =>
      p.id === positionId ? { ...p, ...updates } : p
    )
  })),
  closePosition: (positionId) => set((state) => ({
    positions: state.positions.filter((p) => p.id !== positionId)
  }))
}));

// KYC Store
interface KYCState {
  currentStep: number;
  data: Partial<KYCData>;
  isSubmitting: boolean;
  setStep: (step: number) => void;
  updateData: (data: Partial<KYCData>) => void;
  setSubmitting: (submitting: boolean) => void;
  reset: () => void;
}

export const useKYCStore = create<KYCState>((set) => ({
  currentStep: 1,
  data: {},
  isSubmitting: false,
  setStep: (step) => set({ currentStep: step }),
  updateData: (data) => set((state) => ({ data: { ...state.data, ...data } })),
  setSubmitting: (submitting) => set({ isSubmitting: submitting }),
  reset: () => set({ currentStep: 1, data: {}, isSubmitting: false })
}));

// Notification Store
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: state.unreadCount + 1
  })),
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1)
  })),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0
  })),
  clearAll: () => set({ notifications: [], unreadCount: 0 })
}));

// UI Store
interface UIState {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  activeModal: string | null;
  theme: 'dark' | 'light';
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  openModal: (modal: string) => void;
  closeModal: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mobileMenuOpen: false,
      activeModal: null,
      theme: 'dark',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
      openModal: (modal) => set({ activeModal: modal }),
      closeModal: () => set({ activeModal: null }),
      setTheme: (theme) => set({ theme })
    }),
    {
      name: 'novatrade-ui',
      partialize: (state) => ({ theme: state.theme, sidebarOpen: state.sidebarOpen })
    }
  )
);

// Wallet Store
interface WalletState {
  address: string | null;
  chainId: number | null;
  balance: string;
  isConnected: boolean;
  isConnecting: boolean;
  setWallet: (address: string | null, chainId: number | null) => void;
  setBalance: (balance: string) => void;
  setConnecting: (connecting: boolean) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  chainId: null,
  balance: '0',
  isConnected: false,
  isConnecting: false,
  setWallet: (address, chainId) => set({ 
    address, 
    chainId, 
    isConnected: !!address,
    isConnecting: false 
  }),
  setBalance: (balance) => set({ balance }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  disconnect: () => set({ 
    address: null, 
    chainId: null, 
    balance: '0', 
    isConnected: false 
  })
}));
