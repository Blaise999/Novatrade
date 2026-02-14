/**
 * OLYMP-STYLE TRADING STORE
 * 
 * Client-side state management for the Olymp trading model.
 * 
 * IMPORTANT: This store is for UI state only!
 * All actual balance changes happen SERVER-SIDE via atomic database operations.
 * 
 * The client should:
 * 1. Display trade state (prices, P/L, etc.)
 * 2. Send trade requests to the server
 * 3. Update local state from server responses
 * 4. NEVER modify balance directly
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import OlympTradingEngine from '@/lib/services/olymp-trading-engine';

// ==========================================
// TYPES
// ==========================================

export interface ActiveTrade {
  id: string;
  asset: string;
  assetType: 'crypto' | 'forex' | 'stock' | 'commodity';
  direction: 1 | -1;  // 1 = Buy/Up, -1 = Sell/Down
  
  // Financial data
  investment: number;
  multiplier: number;
  volume: number;
  entryPrice: number;
  
  // Risk management
  liquidationPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  
  // Current state
  currentPrice: number;
  floatingPnL: number;
  floatingPnLPercent: number;
  
  // Timestamps
  openedAt: string;
  updatedAt: string;
}

export interface TradeHistory {
  id: string;
  asset: string;
  direction: 1 | -1;
  investment: number;
  multiplier: number;
  entryPrice: number;
  exitPrice: number;
  finalPnL: number;
  status: 'closed' | 'liquidated' | 'stopped_out' | 'take_profit';
  openedAt: string;
  closedAt: string;
}

export interface OlympTradingState {
  // User data (synced from server)
  userId: string | null;
  balance: number;  // READ-ONLY - synced from server
  
  // Active trades
  activeTrades: ActiveTrade[];
  
  // Trade history
  tradeHistory: TradeHistory[];
  
  // Computed values
  totalUnrealizedPnL: number;
  equity: number;
  totalInvested: number;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // ==========================================
  // ACTIONS
  // ==========================================
  
  // Initialize with user data
  initialize: (userId: string, balance: number) => void;
  
  // Sync balance from server (NEVER calculate locally)
  syncBalance: (balance: number) => void;
  
  // Add trade from server response
  addTrade: (trade: ActiveTrade) => void;
  
  // Update trade price (real-time tick)
  updateTradePrice: (tradeId: string, currentPrice: number) => {
    shouldLiquidate: boolean;
    shouldStopOut: boolean;
    shouldTakeProfit: boolean;
  } | null;
  
  // Update all trades for a symbol
  updateSymbolPrice: (symbol: string, currentPrice: number) => Array<{
    tradeId: string;
    shouldLiquidate: boolean;
    shouldStopOut: boolean;
    shouldTakeProfit: boolean;
  }>;
  
  // Remove trade (after server confirms close)
  removeTrade: (tradeId: string, historyEntry?: TradeHistory) => void;
  
  // Load trades from server
  loadTrades: (trades: ActiveTrade[]) => void;
  
  // Clear all data (on logout)
  clearAll: () => void;
  
  // Set loading/error states
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// ==========================================
// STORE
// ==========================================

export const useOlympTradingStore = create<OlympTradingState>()(
  persist(
    (set, get) => ({
      // Initial state
      userId: null,
      balance: 0,
      activeTrades: [],
      tradeHistory: [],
      totalUnrealizedPnL: 0,
      equity: 0,
      totalInvested: 0,
      isLoading: false,
      error: null,
      
      // ==========================================
      // IMPLEMENTATIONS
      // ==========================================
      
      initialize: (userId, balance) => {
        set({
          userId,
          balance,
          equity: balance,
        });
      },
      
      syncBalance: (balance) => {
        const state = get();
        set({
          balance,
          equity: balance + state.totalUnrealizedPnL,
        });
      },
      
      addTrade: (trade) => {
        set((state) => {
          const newTrades = [...state.activeTrades, trade];
          const totalInvested = newTrades.reduce((sum, t) => sum + t.investment, 0);
          const totalUnrealizedPnL = newTrades.reduce((sum, t) => sum + t.floatingPnL, 0);
          
          return {
            activeTrades: newTrades,
            totalInvested,
            totalUnrealizedPnL,
            equity: state.balance + totalUnrealizedPnL,
          };
        });
      },
      
      updateTradePrice: (tradeId, currentPrice) => {
        const state = get();
        const trade = state.activeTrades.find(t => t.id === tradeId);
        
        if (!trade) return null;
        
        // Calculate new P/L using the engine
        const floatingPnL = OlympTradingEngine.calculateFloatingPnL(
          trade.direction,
          trade.investment,
          trade.multiplier,
          trade.entryPrice,
          currentPrice
        );
        
        const floatingPnLPercent = OlympTradingEngine.calculatePnLPercent(
          trade.direction,
          trade.multiplier,
          trade.entryPrice,
          currentPrice
        );
        
        // Check triggers
        const shouldLiquidate = OlympTradingEngine.shouldLiquidate(floatingPnL, trade.investment);
        const shouldStopOut = OlympTradingEngine.shouldStopOut(trade.direction, currentPrice, trade.stopLoss);
        const shouldTakeProfit = OlympTradingEngine.shouldTakeProfit(trade.direction, currentPrice, trade.takeProfit);
        
        // Update state
        set((state) => {
          const newTrades = state.activeTrades.map(t => 
            t.id === tradeId 
              ? { ...t, currentPrice, floatingPnL, floatingPnLPercent, updatedAt: new Date().toISOString() }
              : t
          );
          
          const totalUnrealizedPnL = newTrades.reduce((sum, t) => sum + t.floatingPnL, 0);
          
          return {
            activeTrades: newTrades,
            totalUnrealizedPnL,
            equity: state.balance + totalUnrealizedPnL,
          };
        });
        
        return { shouldLiquidate, shouldStopOut, shouldTakeProfit };
      },
      
      updateSymbolPrice: (symbol, currentPrice) => {
        const state = get();
        const results: Array<{
          tradeId: string;
          shouldLiquidate: boolean;
          shouldStopOut: boolean;
          shouldTakeProfit: boolean;
        }> = [];
        
        const tradesForSymbol = state.activeTrades.filter(t => t.asset === symbol);
        
        for (const trade of tradesForSymbol) {
          const result = get().updateTradePrice(trade.id, currentPrice);
          if (result) {
            results.push({ tradeId: trade.id, ...result });
          }
        }
        
        return results;
      },
      
      removeTrade: (tradeId, historyEntry) => {
        set((state) => {
          const newTrades = state.activeTrades.filter(t => t.id !== tradeId);
          const totalInvested = newTrades.reduce((sum, t) => sum + t.investment, 0);
          const totalUnrealizedPnL = newTrades.reduce((sum, t) => sum + t.floatingPnL, 0);
          
          const newHistory = historyEntry 
            ? [historyEntry, ...state.tradeHistory.slice(0, 99)]
            : state.tradeHistory;
          
          return {
            activeTrades: newTrades,
            tradeHistory: newHistory,
            totalInvested,
            totalUnrealizedPnL,
            equity: state.balance + totalUnrealizedPnL,
          };
        });
      },
      
      loadTrades: (trades) => {
        set((state) => {
          const totalInvested = trades.reduce((sum, t) => sum + t.investment, 0);
          const totalUnrealizedPnL = trades.reduce((sum, t) => sum + t.floatingPnL, 0);
          
          return {
            activeTrades: trades,
            totalInvested,
            totalUnrealizedPnL,
            equity: state.balance + totalUnrealizedPnL,
          };
        });
      },
      
      clearAll: () => {
        set({
          userId: null,
          balance: 0,
          activeTrades: [],
          tradeHistory: [],
          totalUnrealizedPnL: 0,
          equity: 0,
          totalInvested: 0,
          isLoading: false,
          error: null,
        });
      },
      
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'olymp-trading-store',
      partialize: (state) => ({
        userId: state.userId,
        activeTrades: state.activeTrades,
        tradeHistory: state.tradeHistory.slice(0, 50),
      }),
    }
  )
);

// ==========================================
// HOOKS
// ==========================================

/**
 * Hook to get computed trading stats
 */
export function useOlympTradingStats() {
  const store = useOlympTradingStore();
  
  return {
    balance: store.balance,
    equity: store.equity,
    totalInvested: store.totalInvested,
    totalUnrealizedPnL: store.totalUnrealizedPnL,
    activeTradesCount: store.activeTrades.length,
    marginLevel: store.totalInvested > 0 
      ? (store.equity / store.totalInvested) * 100 
      : undefined,
  };
}

/**
 * Hook to get trades for a specific symbol
 */
export function useTradesForSymbol(symbol: string) {
  const activeTrades = useOlympTradingStore(state => state.activeTrades);
  return activeTrades.filter(t => t.asset === symbol);
}

/**
 * Hook for real-time P/L calculation
 */
export function useRealtimePnL(tradeId: string) {
  const trade = useOlympTradingStore(state => 
    state.activeTrades.find(t => t.id === tradeId)
  );
  
  if (!trade) return null;
  
  return {
    floatingPnL: trade.floatingPnL,
    floatingPnLPercent: trade.floatingPnLPercent,
    isProfit: trade.floatingPnL > 0,
    isAtRisk: trade.floatingPnL <= -(trade.investment * 0.5),
    isNearLiquidation: trade.floatingPnL <= -(trade.investment * 0.9),
  };
}

export default useOlympTradingStore;
