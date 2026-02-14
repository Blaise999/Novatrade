'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import OlympTradingEngine from '@/lib/services/olymp-trading-engine';

export interface ActiveTrade {
  id: string;
  asset: string;
  assetType: 'crypto' | 'forex' | 'stock' | 'commodity';
  direction: 1 | -1;

  investment: number;
  multiplier: number;
  volume: number;

  spreadPercent: number;
  entryPrice: number;
  liquidationPrice: number;

  stopLoss?: number;
  takeProfit?: number;

  midPrice: number;
  effectiveExitPrice: number;

  floatingPnL: number;
  floatingPnLPercent: number;

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
  userId: string | null;
  balance: number; // server-synced only

  activeTrades: ActiveTrade[];
  tradeHistory: TradeHistory[];

  totalUnrealizedPnL: number;
  equity: number;
  totalInvested: number;

  isLoading: boolean;
  error: string | null;

  initialize: (userId: string, balance: number) => void;
  setFromServer: (payload: { balance?: number; activeTrades?: ActiveTrade[]; history?: TradeHistory[] }) => void;

  syncBalance: (balance: number) => void;
  loadTrades: (trades: ActiveTrade[]) => void;

  // IMPORTANT: this takes MID price (not bid/ask)
  updateTradeMidPrice: (tradeId: string, midPrice: number) => {
    shouldLiquidate: boolean;
    shouldStopOut: boolean;
    shouldTakeProfit: boolean;
  } | null;

  updateSymbolMidPrice: (symbol: string, midPrice: number) => Array<{
    tradeId: string;
    shouldLiquidate: boolean;
    shouldStopOut: boolean;
    shouldTakeProfit: boolean;
  }>;

  removeTrade: (tradeId: string, historyEntry?: TradeHistory) => void;

  clearAll: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

function recompute(state: Pick<OlympTradingState, 'balance' | 'activeTrades'>) {
  const totalInvested = state.activeTrades.reduce((s, t) => s + (Number(t.investment) || 0), 0);
  const totalUnrealizedPnL = state.activeTrades.reduce((s, t) => s + (Number(t.floatingPnL) || 0), 0);
  const equity = (Number(state.balance) || 0) + totalUnrealizedPnL;
  return { totalInvested, totalUnrealizedPnL, equity };
}

export const useOlympTradingStore = create<OlympTradingState>()(
  persist(
    (set, get) => ({
      userId: null,
      balance: 0,
      activeTrades: [],
      tradeHistory: [],
      totalUnrealizedPnL: 0,
      equity: 0,
      totalInvested: 0,
      isLoading: false,
      error: null,

      initialize: (userId, balance) => {
        set({ userId, balance, equity: balance });
      },

      setFromServer: ({ balance, activeTrades, history }) => {
        set((s) => {
          const nextBalance = balance != null ? Number(balance) || 0 : s.balance;
          const nextTrades = activeTrades != null ? activeTrades : s.activeTrades;
          const nextHistory = history != null ? history : s.tradeHistory;
          const { totalInvested, totalUnrealizedPnL, equity } = recompute({ balance: nextBalance, activeTrades: nextTrades });
          return {
            balance: nextBalance,
            activeTrades: nextTrades,
            tradeHistory: nextHistory,
            totalInvested,
            totalUnrealizedPnL,
            equity,
          };
        });
      },

      syncBalance: (balance) => {
        set((s) => {
          const nextBalance = Number(balance) || 0;
          const { totalInvested, totalUnrealizedPnL, equity } = recompute({ balance: nextBalance, activeTrades: s.activeTrades });
          return { balance: nextBalance, totalInvested, totalUnrealizedPnL, equity };
        });
      },

      loadTrades: (trades) => {
        set((s) => {
          const nextTrades = trades || [];
          const { totalInvested, totalUnrealizedPnL, equity } = recompute({ balance: s.balance, activeTrades: nextTrades });
          return { activeTrades: nextTrades, totalInvested, totalUnrealizedPnL, equity };
        });
      },

      updateTradeMidPrice: (tradeId, midPrice) => {
        const state = get();
        const trade = state.activeTrades.find((t) => t.id === tradeId);
        if (!trade) return null;

        const res = OlympTradingEngine.updateTradeWithMidPrice(
          {
            ...trade,
            orderId: trade.id,
            userId: state.userId || '',
            status: 'active',
          } as any,
          midPrice
        );

        set((s) => {
          const nextTrades = s.activeTrades.map((t) =>
            t.id === tradeId
              ? {
                  ...t,
                  midPrice,
                  effectiveExitPrice: res.effectiveExitPrice,
                  floatingPnL: res.floatingPnL,
                  floatingPnLPercent: res.floatingPnLPercent,
                  updatedAt: new Date().toISOString(),
                }
              : t
          );

          const { totalInvested, totalUnrealizedPnL, equity } = recompute({ balance: s.balance, activeTrades: nextTrades });
          return { activeTrades: nextTrades, totalInvested, totalUnrealizedPnL, equity };
        });

        return {
          shouldLiquidate: res.shouldLiquidate,
          shouldStopOut: res.shouldStopOut,
          shouldTakeProfit: res.shouldTakeProfit,
        };
      },

      updateSymbolMidPrice: (symbol, midPrice) => {
        const state = get();
        const trades = state.activeTrades.filter((t) => t.asset === symbol);
        const out: any[] = [];
        for (const t of trades) {
          const r = get().updateTradeMidPrice(t.id, midPrice);
          if (r) out.push({ tradeId: t.id, ...r });
        }
        return out;
      },

      removeTrade: (tradeId, historyEntry) => {
        set((s) => {
          const nextTrades = s.activeTrades.filter((t) => t.id !== tradeId);
          const nextHistory = historyEntry ? [historyEntry, ...s.tradeHistory].slice(0, 100) : s.tradeHistory;
          const { totalInvested, totalUnrealizedPnL, equity } = recompute({ balance: s.balance, activeTrades: nextTrades });
          return { activeTrades: nextTrades, tradeHistory: nextHistory, totalInvested, totalUnrealizedPnL, equity };
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
      // ✅ don’t persist open trades (server is source of truth)
      partialize: (s) => ({
        userId: s.userId,
        tradeHistory: s.tradeHistory.slice(0, 50),
      }),
    }
  )
);

export default useOlympTradingStore;
