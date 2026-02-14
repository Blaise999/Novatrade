/**
 * FX TRADING CLIENT STORE (SERVER-BACKED)
 * ========================================
 * 
 * This store manages FX trades with ALL operations going through the server API.
 * The server is the ONLY source of truth for balance and trades.
 * 
 * NO LOCAL BALANCE MODIFICATIONS!
 */

'use client';

import { create } from 'zustand';

// ==========================================
// TYPES
// ==========================================

export interface FXTrade {
  id: string;
  symbol: string;
  direction: 'buy' | 'sell';
  directionInt: 1 | -1;
  investment: number;
  multiplier: number;
  entryPrice: number;
  liquidationPrice: number;
  currentPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  floatingPnL: number;
  finalPnL: number | null;
  spreadCost: number;
  status: 'open' | 'active' | 'pending' | 'closed' | 'won' | 'lost' | 'liquidated' | 'stopped_out' | 'take_profit';
  openedAt: string;
  closedAt: string | null;
}

interface FXTradingState {
  // Server data (source of truth)
  balance: number;
  trades: FXTrade[];
  
  // Derived values (calculated from trades)
  totalInvested: number;
  totalUnrealizedPnL: number;
  equity: number;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  lastSync: Date | null;
  
  // Actions
  setBalance: (balance: number) => void;
  setTrades: (trades: FXTrade[]) => void;
  updateTradePrice: (tradeId: string, currentPrice: number) => void;
  updateAllPrices: (symbol: string, currentPrice: number) => void;
  addTrade: (trade: FXTrade) => void;
  removeTrade: (tradeId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Server sync
  syncFromServer: (userId: string) => Promise<void>;
}

// ==========================================
// P/L CALCULATION (OLYMP STYLE)
// ==========================================

function calculatePnL(
  direction: number,
  investment: number,
  multiplier: number,
  entryPrice: number,
  currentPrice: number
): number {
  if (entryPrice <= 0) return 0;
  const relativeChange = (currentPrice - entryPrice) / entryPrice;
  return direction * investment * multiplier * relativeChange;
}

// ==========================================
// STORE
// ==========================================

export const useFXTradingStore = create<FXTradingState>((set, get) => ({
  // Initial state
  balance: 0,
  trades: [],
  totalInvested: 0,
  totalUnrealizedPnL: 0,
  equity: 0,
  isLoading: false,
  error: null,
  lastSync: null,
  
  // Balance setter (from server only)
  setBalance: (balance) => {
    const state = get();
    set({
      balance,
      equity: balance + state.totalUnrealizedPnL,
    });
  },
  
  // Set trades from server
  setTrades: (trades) => {
    const activeTrades = trades.filter(t => 
      ['open', 'active', 'pending'].includes(t.status)
    );
    
    const totalInvested = activeTrades.reduce((sum, t) => sum + t.investment, 0);
    const totalUnrealizedPnL = activeTrades.reduce((sum, t) => sum + t.floatingPnL, 0);
    
    set({
      trades,
      totalInvested,
      totalUnrealizedPnL,
      equity: get().balance + totalUnrealizedPnL,
    });
  },
  
  // Update single trade price (local calculation, not persisted)
  updateTradePrice: (tradeId, currentPrice) => {
    set(state => {
      const updatedTrades = state.trades.map(trade => {
        if (trade.id !== tradeId) return trade;
        if (!['open', 'active', 'pending'].includes(trade.status)) return trade;
        
        const floatingPnL = calculatePnL(
          trade.directionInt,
          trade.investment,
          trade.multiplier,
          trade.entryPrice,
          currentPrice
        );
        
        return {
          ...trade,
          currentPrice,
          floatingPnL,
        };
      });
      
      const activeTrades = updatedTrades.filter(t => 
        ['open', 'active', 'pending'].includes(t.status)
      );
      const totalUnrealizedPnL = activeTrades.reduce((sum, t) => sum + t.floatingPnL, 0);
      
      return {
        trades: updatedTrades,
        totalUnrealizedPnL,
        equity: state.balance + totalUnrealizedPnL,
      };
    });
  },
  
  // Update all trades for a symbol
  updateAllPrices: (symbol, currentPrice) => {
    set(state => {
      const updatedTrades = state.trades.map(trade => {
        if (trade.symbol !== symbol) return trade;
        if (!['open', 'active', 'pending'].includes(trade.status)) return trade;
        
        const floatingPnL = calculatePnL(
          trade.directionInt,
          trade.investment,
          trade.multiplier,
          trade.entryPrice,
          currentPrice
        );
        
        return {
          ...trade,
          currentPrice,
          floatingPnL,
        };
      });
      
      const activeTrades = updatedTrades.filter(t => 
        ['open', 'active', 'pending'].includes(t.status)
      );
      const totalUnrealizedPnL = activeTrades.reduce((sum, t) => sum + t.floatingPnL, 0);
      
      return {
        trades: updatedTrades,
        totalUnrealizedPnL,
        equity: state.balance + totalUnrealizedPnL,
      };
    });
  },
  
  // Add trade (after server confirms)
  addTrade: (trade) => {
    set(state => {
      const newTrades = [...state.trades, trade];
      const activeTrades = newTrades.filter(t => 
        ['open', 'active', 'pending'].includes(t.status)
      );
      const totalInvested = activeTrades.reduce((sum, t) => sum + t.investment, 0);
      const totalUnrealizedPnL = activeTrades.reduce((sum, t) => sum + t.floatingPnL, 0);
      
      return {
        trades: newTrades,
        totalInvested,
        totalUnrealizedPnL,
        equity: state.balance + totalUnrealizedPnL,
      };
    });
  },
  
  // Remove trade (after server confirms close)
  removeTrade: (tradeId) => {
    set(state => {
      const newTrades = state.trades.filter(t => t.id !== tradeId);
      const activeTrades = newTrades.filter(t => 
        ['open', 'active', 'pending'].includes(t.status)
      );
      const totalInvested = activeTrades.reduce((sum, t) => sum + t.investment, 0);
      const totalUnrealizedPnL = activeTrades.reduce((sum, t) => sum + t.floatingPnL, 0);
      
      return {
        trades: newTrades,
        totalInvested,
        totalUnrealizedPnL,
        equity: state.balance + totalUnrealizedPnL,
      };
    });
  },
  
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  // Sync with server
  syncFromServer: async (userId) => {
    set({ isLoading: true, error: null });
    
    try {
      // Fetch balance
      const balanceRes = await fetch('/api/balance', {
        headers: { 'x-user-id': userId },
      });
      
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        if (balanceData.success) {
          set({ balance: balanceData.balance || 0 });
        }
      }
      
      // Fetch active FX trades
      const tradesRes = await fetch('/api/fx/trades?status=active', {
        headers: { 'x-user-id': userId },
      });
      
      if (tradesRes.ok) {
        const tradesData = await tradesRes.json();
        if (tradesData.success) {
          get().setTrades(tradesData.trades || []);
        }
      }
      
      set({ lastSync: new Date(), isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to sync with server',
        isLoading: false,
      });
    }
  },
}));

// ==========================================
// HOOKS
// ==========================================

/**
 * Get active FX trades
 */
export function useActiveFXTrades() {
  return useFXTradingStore(state => 
    state.trades.filter(t => ['open', 'active', 'pending'].includes(t.status))
  );
}

/**
 * Get trades for specific symbol
 */
export function useFXTradesForSymbol(symbol: string) {
  return useFXTradingStore(state => 
    state.trades.filter(t => t.symbol === symbol)
  );
}

/**
 * Get FX trading stats
 */
export function useFXTradingStats() {
  return useFXTradingStore(state => ({
    balance: state.balance,
    equity: state.equity,
    totalInvested: state.totalInvested,
    totalUnrealizedPnL: state.totalUnrealizedPnL,
    activeCount: state.trades.filter(t => ['open', 'active', 'pending'].includes(t.status)).length,
  }));
}

// ==========================================
// API HELPERS
// ==========================================

export interface OpenFXTradeParams {
  userId: string;
  symbol: string;
  name?: string;
  direction: 'buy' | 'sell';
  investment: number;
  multiplier: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface CloseFXTradeParams {
  userId: string;
  tradeId: string;
  exitPrice: number;
  reason?: 'manual' | 'liquidated' | 'stopped_out' | 'take_profit';
}

/**
 * Open FX trade via server API
 */
export async function openFXTrade(params: OpenFXTradeParams): Promise<{
  success: boolean;
  trade?: FXTrade;
  newBalance?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/fx/trades', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': params.userId,
        'x-idempotency-key': `${params.userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      body: JSON.stringify({
        symbol: params.symbol,
        name: params.name,
        direction: params.direction,
        investment: params.investment,
        multiplier: params.multiplier,
        currentPrice: params.currentPrice,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
      }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      return { success: false, error: data.error || 'Failed to open trade' };
    }
    
    // Update local store
    const store = useFXTradingStore.getState();
    
    if (data.newBalance !== undefined) {
      store.setBalance(data.newBalance);
    }
    
    if (data.trade) {
      store.addTrade({
        id: data.trade.id,
        symbol: data.trade.symbol,
        direction: data.trade.direction,
        directionInt: data.trade.direction === 'buy' ? 1 : -1,
        investment: data.trade.investment,
        multiplier: data.trade.multiplier,
        entryPrice: data.trade.entryPrice,
        liquidationPrice: data.trade.liquidationPrice,
        currentPrice: data.trade.entryPrice,
        exitPrice: null,
        stopLoss: data.trade.stopLoss || null,
        takeProfit: data.trade.takeProfit || null,
        floatingPnL: -data.trade.spreadCost || 0,
        finalPnL: null,
        spreadCost: data.trade.spreadCost || 0,
        status: 'open',
        openedAt: new Date().toISOString(),
        closedAt: null,
      });
    }
    
    return {
      success: true,
      trade: data.trade,
      newBalance: data.newBalance,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Close FX trade via server API
 */
export async function closeFXTrade(params: CloseFXTradeParams): Promise<{
  success: boolean;
  finalPnL?: number;
  newBalance?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/fx/trades', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': params.userId,
      },
      body: JSON.stringify({
        tradeId: params.tradeId,
        exitPrice: params.exitPrice,
        reason: params.reason || 'manual',
      }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      return { success: false, error: data.error || 'Failed to close trade' };
    }
    
    // Update local store
    const store = useFXTradingStore.getState();
    
    if (data.newBalance !== undefined) {
      store.setBalance(data.newBalance);
    }
    
    store.removeTrade(params.tradeId);
    
    return {
      success: true,
      finalPnL: data.trade?.finalPnL,
      newBalance: data.newBalance,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

export default useFXTradingStore;
