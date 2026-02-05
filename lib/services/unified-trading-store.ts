/**
 * UNIFIED TRADING STORE
 * 
 * Single source of truth for all trading:
 * - FX/Forex (Margin Trading)
 * - Stocks (Spot Trading)
 * - Crypto (Spot Trading with Shield)
 * 
 * All trades sync to the user's Supabase balance.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  FXPosition,
  StockPosition,
  CryptoPosition,
  AccountMetrics,
  calculateFXPnL,
  calculateMargin,
  calculateNotional,
  calculateStockPnL,
  calculateNewAvgPrice,
  calculateRealizedPnL,
  calculateAccountMetrics,
  calculateLiquidationPrice,
  updateFXPositionPrice,
  updateStockPositionPrice,
  updateCryptoPositionPrice,
  syncBalanceToSupabase,
  lotsToUnits,
  unitsToLots,
  isStopLossTriggered,
  isTakeProfitTriggered,
} from './unified-trading-engine';

// ==========================================
// STORE STATE INTERFACE
// ==========================================

interface UnifiedTradingState {
  // User info
  userId: string | null;
  
  // Cash balance (synced from Supabase)
  balance: number;
  
  // Positions
  fxPositions: FXPosition[];
  stockPositions: StockPosition[];
  cryptoPositions: CryptoPosition[];
  
  // Computed metrics
  metrics: AccountMetrics;
  
  // Real-time prices
  fxPrices: Record<string, { bid: number; ask: number }>;
  stockPrices: Record<string, number>;
  cryptoPrices: Record<string, number>;
  
  // Trade history
  realizedPnLHistory: Array<{
    id: string;
    type: 'fx' | 'stock' | 'crypto';
    symbol: string;
    pnl: number;
    closedAt: Date;
  }>;
  
  // ==========================================
  // INITIALIZATION
  // ==========================================
  initialize: (userId: string, balance: number) => void;
  syncBalance: (balance: number) => void;
  
  // ==========================================
  // FX TRADING
  // ==========================================
  openFXPosition: (params: {
    symbol: string;
    name: string;
    side: 'long' | 'short';
    lots: number;
    price: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
    spreadCost?: number;
  }) => { success: boolean; error?: string; position?: FXPosition };
  
  closeFXPosition: (
    positionId: string,
    closePrice: number
  ) => { success: boolean; realizedPnL?: number; error?: string };
  
  updateFXPrice: (symbol: string, bid: number, ask: number) => void;
  
  // ==========================================
  // STOCK TRADING
  // ==========================================
  buyStock: (params: {
    symbol: string;
    name: string;
    qty: number;
    price: number;
    fee?: number;
  }) => { success: boolean; error?: string };
  
  sellStock: (
    positionId: string,
    qty: number,
    price: number,
    fee?: number
  ) => { success: boolean; realizedPnL?: number; error?: string };
  
  updateStockPrice: (symbol: string, price: number) => void;
  
  // ==========================================
  // CRYPTO TRADING
  // ==========================================
  buyCrypto: (params: {
    symbol: string;
    name: string;
    quantity: number;
    price: number;
    fee?: number;
  }) => { success: boolean; error?: string };
  
  sellCrypto: (
    positionId: string,
    quantity: number,
    price: number,
    fee?: number
  ) => { success: boolean; realizedPnL?: number; error?: string };
  
  updateCryptoPrice: (symbol: string, price: number) => void;
  toggleCryptoShield: (positionId: string) => void;
  
  // ==========================================
  // COMPUTED GETTERS
  // ==========================================
  getMetrics: () => AccountMetrics;
  getTotalEquity: () => number;
  getTotalUnrealizedPnL: () => number;
  getFXPositionBySymbol: (symbol: string) => FXPosition | undefined;
  getStockPositionBySymbol: (symbol: string) => StockPosition | undefined;
  getCryptoPositionBySymbol: (symbol: string) => CryptoPosition | undefined;
  
  // ==========================================
  // RISK MANAGEMENT
  // ==========================================
  checkAndExecuteSLTP: () => void;
}

// ==========================================
// STORE IMPLEMENTATION
// ==========================================

export const useUnifiedTradingStore = create<UnifiedTradingState>()(
  persist(
    (set, get) => ({
      userId: null,
      balance: 0,
      fxPositions: [],
      stockPositions: [],
      cryptoPositions: [],
      metrics: {
        balance: 0,
        equity: 0,
        usedMargin: 0,
        freeMargin: 0,
        totalUnrealizedPnL: 0,
        totalRealizedPnL: 0,
        portfolioValue: 0,
      },
      fxPrices: {},
      stockPrices: {},
      cryptoPrices: {},
      realizedPnLHistory: [],
      
      // ==========================================
      // INITIALIZATION
      // ==========================================
      initialize: (userId, balance) => {
        set({ userId, balance });
        const state = get();
        const metrics = calculateAccountMetrics(
          balance,
          state.fxPositions,
          state.stockPositions,
          state.cryptoPositions
        );
        set({ metrics });
      },
      
      syncBalance: (balance) => {
        set({ balance });
        const state = get();
        const metrics = calculateAccountMetrics(
          balance,
          state.fxPositions,
          state.stockPositions,
          state.cryptoPositions
        );
        set({ metrics });
      },
      
      // ==========================================
      // FX TRADING IMPLEMENTATION
      // ==========================================
      openFXPosition: (params) => {
        const state = get();
        const { symbol, name, side, lots, price, leverage, stopLoss, takeProfit, spreadCost = 0 } = params;
        
        if (!state.userId) {
          return { success: false, error: 'Not initialized' };
        }
        
        const units = lotsToUnits(lots);
        const notional = calculateNotional(units, price);
        const margin = calculateMargin(units, price, leverage);
        
        // Check if we have enough free margin
        if (margin > state.metrics.freeMargin) {
          return { success: false, error: `Insufficient margin. Required: $${margin.toFixed(2)}, Available: $${state.metrics.freeMargin.toFixed(2)}` };
        }
        
        const now = new Date();
        const newPosition: FXPosition = {
          id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          userId: state.userId,
          symbol,
          name,
          side,
          units,
          openPrice: price,
          currentPrice: price,
          leverage,
          notional,
          margin,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          stopLoss,
          takeProfit,
          spreadCost,
          swapAccumulated: 0,
          openedAt: now,
          updatedAt: now,
        };
        
        // Deduct spread cost from balance
        const newBalance = state.balance - spreadCost;
        
        set((s) => {
          const newFxPositions = [...s.fxPositions, newPosition];
          const metrics = calculateAccountMetrics(
            newBalance,
            newFxPositions,
            s.stockPositions,
            s.cryptoPositions
          );
          return {
            balance: newBalance,
            fxPositions: newFxPositions,
            metrics,
          };
        });
        
        // Sync spread cost to Supabase
        if (spreadCost > 0) {
          syncBalanceToSupabase(
            state.userId,
            newBalance,
            -spreadCost,
            `FX Open: ${side.toUpperCase()} ${lots} lots ${symbol}`
          );
        }
        
        return { success: true, position: newPosition };
      },
      
      closeFXPosition: (positionId, closePrice) => {
        const state = get();
        const position = state.fxPositions.find((p) => p.id === positionId);
        
        if (!position) {
          return { success: false, error: 'Position not found' };
        }
        
        if (!state.userId) {
          return { success: false, error: 'Not initialized' };
        }
        
        // Calculate realized P/L using the formula
        const realizedPnL = calculateFXPnL(
          position.side,
          position.openPrice,
          closePrice,
          position.units
        );
        
        // Update balance with P/L
        const newBalance = state.balance + realizedPnL;
        
        set((s) => {
          const newFxPositions = s.fxPositions.filter((p) => p.id !== positionId);
          const metrics = calculateAccountMetrics(
            newBalance,
            newFxPositions,
            s.stockPositions,
            s.cryptoPositions
          );
          return {
            balance: newBalance,
            fxPositions: newFxPositions,
            metrics,
            realizedPnLHistory: [
              ...s.realizedPnLHistory,
              {
                id: `pnl_${Date.now()}`,
                type: 'fx' as const,
                symbol: position.symbol,
                pnl: realizedPnL,
                closedAt: new Date(),
              },
            ],
          };
        });
        
        // 🔥 CRITICAL: Sync realized P/L to Supabase
        syncBalanceToSupabase(
          state.userId,
          newBalance,
          realizedPnL,
          `FX Close: ${position.side.toUpperCase()} ${unitsToLots(position.units)} lots ${position.symbol} | P/L: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`
        );
        
        return { success: true, realizedPnL };
      },
      
      updateFXPrice: (symbol, bid, ask) => {
        set((state) => {
          const newPrices = {
            ...state.fxPrices,
            [symbol]: { bid, ask },
          };
          
          // Update positions with this symbol
          const newFxPositions = state.fxPositions.map((p) => {
            if (p.symbol === symbol) {
              // Use bid for closing longs, ask for closing shorts
              const markPrice = p.side === 'long' ? bid : ask;
              return updateFXPositionPrice(p, markPrice);
            }
            return p;
          });
          
          // Recalculate metrics
          const metrics = calculateAccountMetrics(
            state.balance,
            newFxPositions,
            state.stockPositions,
            state.cryptoPositions
          );
          
          return {
            fxPrices: newPrices,
            fxPositions: newFxPositions,
            metrics,
          };
        });
        
        // Check SL/TP after price update
        get().checkAndExecuteSLTP();
      },
      
      // ==========================================
      // STOCK TRADING IMPLEMENTATION
      // ==========================================
      buyStock: (params) => {
        const state = get();
        const { symbol, name, qty, price, fee = 0 } = params;
        
        if (!state.userId) {
          return { success: false, error: 'Not initialized' };
        }
        
        const totalCost = qty * price + fee;
        
        if (totalCost > state.balance) {
          return { success: false, error: `Insufficient funds. Required: $${totalCost.toFixed(2)}, Available: $${state.balance.toFixed(2)}` };
        }
        
        const newBalance = state.balance - totalCost;
        const existingPosition = state.stockPositions.find((p) => p.symbol === symbol);
        const now = new Date();
        
        if (existingPosition) {
          // Add to existing position with weighted average
          const newAvgPrice = calculateNewAvgPrice(
            existingPosition.qty,
            existingPosition.avgPrice,
            qty,
            price,
            fee
          );
          const newQty = existingPosition.qty + qty;
          const marketValue = newQty * existingPosition.currentPrice;
          const costBasis = newQty * newAvgPrice;
          const { pnl, pnlPercent } = calculateStockPnL(newQty, newAvgPrice, existingPosition.currentPrice);
          
          set((s) => {
            const newStockPositions = s.stockPositions.map((p) =>
              p.symbol === symbol
                ? {
                    ...p,
                    qty: newQty,
                    avgPrice: newAvgPrice,
                    marketValue,
                    costBasis,
                    unrealizedPnL: pnl,
                    unrealizedPnLPercent: pnlPercent,
                    updatedAt: now,
                  }
                : p
            );
            const metrics = calculateAccountMetrics(
              newBalance,
              s.fxPositions,
              newStockPositions,
              s.cryptoPositions
            );
            return {
              balance: newBalance,
              stockPositions: newStockPositions,
              metrics,
            };
          });
        } else {
          // Create new position
          const newPosition: StockPosition = {
            id: `stock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            userId: state.userId,
            symbol,
            name,
            qty,
            avgPrice: price,
            currentPrice: price,
            marketValue: qty * price,
            costBasis: qty * price,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
            openedAt: now,
            updatedAt: now,
          };
          
          set((s) => {
            const newStockPositions = [...s.stockPositions, newPosition];
            const metrics = calculateAccountMetrics(
              newBalance,
              s.fxPositions,
              newStockPositions,
              s.cryptoPositions
            );
            return {
              balance: newBalance,
              stockPositions: newStockPositions,
              metrics,
            };
          });
        }
        
        // 🔥 Sync to Supabase (deduct cost)
        syncBalanceToSupabase(
          state.userId,
          newBalance,
          -totalCost,
          `Stock Buy: ${qty} ${symbol} @ $${price.toFixed(2)}`
        );
        
        return { success: true };
      },
      
      sellStock: (positionId, qty, price, fee = 0) => {
        const state = get();
        const position = state.stockPositions.find((p) => p.id === positionId);
        
        if (!position) {
          return { success: false, error: 'Position not found' };
        }
        
        if (!state.userId) {
          return { success: false, error: 'Not initialized' };
        }
        
        if (qty > position.qty) {
          return { success: false, error: 'Quantity exceeds position' };
        }
        
        // Calculate realized P/L using the formula
        const realizedPnL = calculateRealizedPnL(position.avgPrice, price, qty, fee);
        const proceeds = qty * price - fee;
        const newBalance = state.balance + proceeds;
        const now = new Date();
        
        if (qty === position.qty) {
          // Close entire position
          set((s) => {
            const newStockPositions = s.stockPositions.filter((p) => p.id !== positionId);
            const metrics = calculateAccountMetrics(
              newBalance,
              s.fxPositions,
              newStockPositions,
              s.cryptoPositions
            );
            return {
              balance: newBalance,
              stockPositions: newStockPositions,
              metrics,
              realizedPnLHistory: [
                ...s.realizedPnLHistory,
                {
                  id: `pnl_${Date.now()}`,
                  type: 'stock' as const,
                  symbol: position.symbol,
                  pnl: realizedPnL,
                  closedAt: now,
                },
              ],
            };
          });
        } else {
          // Partial close
          const newQty = position.qty - qty;
          set((s) => {
            const newStockPositions = s.stockPositions.map((p) =>
              p.id === positionId
                ? {
                    ...p,
                    qty: newQty,
                    marketValue: newQty * p.currentPrice,
                    costBasis: newQty * p.avgPrice,
                    unrealizedPnL: (p.currentPrice - p.avgPrice) * newQty,
                    updatedAt: now,
                  }
                : p
            );
            const metrics = calculateAccountMetrics(
              newBalance,
              s.fxPositions,
              newStockPositions,
              s.cryptoPositions
            );
            return {
              balance: newBalance,
              stockPositions: newStockPositions,
              metrics,
              realizedPnLHistory: [
                ...s.realizedPnLHistory,
                {
                  id: `pnl_${Date.now()}`,
                  type: 'stock' as const,
                  symbol: position.symbol,
                  pnl: realizedPnL,
                  closedAt: now,
                },
              ],
            };
          });
        }
        
        // 🔥 Sync to Supabase
        syncBalanceToSupabase(
          state.userId,
          newBalance,
          proceeds,
          `Stock Sell: ${qty} ${position.symbol} @ $${price.toFixed(2)} | P/L: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`
        );
        
        return { success: true, realizedPnL };
      },
      
      updateStockPrice: (symbol, price) => {
        set((state) => {
          const newPrices = {
            ...state.stockPrices,
            [symbol]: price,
          };
          
          const newStockPositions = state.stockPositions.map((p) => {
            if (p.symbol === symbol) {
              return updateStockPositionPrice(p, price);
            }
            return p;
          });
          
          const metrics = calculateAccountMetrics(
            state.balance,
            state.fxPositions,
            newStockPositions,
            state.cryptoPositions
          );
          
          return {
            stockPrices: newPrices,
            stockPositions: newStockPositions,
            metrics,
          };
        });
      },
      
      // ==========================================
      // CRYPTO TRADING IMPLEMENTATION
      // ==========================================
      buyCrypto: (params) => {
        const state = get();
        const { symbol, name, quantity, price, fee = 0 } = params;
        
        if (!state.userId) {
          return { success: false, error: 'Not initialized' };
        }
        
        const totalCost = quantity * price + fee;
        
        if (totalCost > state.balance) {
          return { success: false, error: `Insufficient funds. Required: $${totalCost.toFixed(2)}, Available: $${state.balance.toFixed(2)}` };
        }
        
        const newBalance = state.balance - totalCost;
        const existingPosition = state.cryptoPositions.find((p) => p.symbol === symbol);
        const now = new Date();
        
        if (existingPosition) {
          // Add to existing position
          const newAvgPrice = calculateNewAvgPrice(
            existingPosition.quantity,
            existingPosition.avgBuyPrice,
            quantity,
            price,
            fee
          );
          const newQuantity = existingPosition.quantity + quantity;
          const marketValue = newQuantity * existingPosition.currentPrice;
          const costBasis = newQuantity * newAvgPrice;
          const pnl = marketValue - costBasis;
          const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
          
          set((s) => {
            const newCryptoPositions = s.cryptoPositions.map((p) =>
              p.symbol === symbol
                ? {
                    ...p,
                    quantity: newQuantity,
                    avgBuyPrice: newAvgPrice,
                    marketValue,
                    costBasis,
                    unrealizedPnL: pnl,
                    unrealizedPnLPercent: pnlPercent,
                    updatedAt: now,
                  }
                : p
            );
            const metrics = calculateAccountMetrics(
              newBalance,
              s.fxPositions,
              s.stockPositions,
              newCryptoPositions
            );
            return {
              balance: newBalance,
              cryptoPositions: newCryptoPositions,
              metrics,
            };
          });
        } else {
          const newPosition: CryptoPosition = {
            id: `crypto_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            userId: state.userId,
            symbol,
            name,
            quantity,
            avgBuyPrice: price,
            currentPrice: price,
            marketValue: quantity * price,
            costBasis: quantity * price,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
            shieldEnabled: false,
            openedAt: now,
            updatedAt: now,
          };
          
          set((s) => {
            const newCryptoPositions = [...s.cryptoPositions, newPosition];
            const metrics = calculateAccountMetrics(
              newBalance,
              s.fxPositions,
              s.stockPositions,
              newCryptoPositions
            );
            return {
              balance: newBalance,
              cryptoPositions: newCryptoPositions,
              metrics,
            };
          });
        }
        
        syncBalanceToSupabase(
          state.userId,
          newBalance,
          -totalCost,
          `Crypto Buy: ${quantity} ${symbol} @ $${price.toFixed(2)}`
        );
        
        return { success: true };
      },
      
      sellCrypto: (positionId, quantity, price, fee = 0) => {
        const state = get();
        const position = state.cryptoPositions.find((p) => p.id === positionId);
        
        if (!position) {
          return { success: false, error: 'Position not found' };
        }
        
        if (!state.userId) {
          return { success: false, error: 'Not initialized' };
        }
        
        if (quantity > position.quantity) {
          return { success: false, error: 'Quantity exceeds position' };
        }
        
        const realizedPnL = calculateRealizedPnL(position.avgBuyPrice, price, quantity, fee);
        const proceeds = quantity * price - fee;
        const newBalance = state.balance + proceeds;
        const now = new Date();
        
        if (quantity === position.quantity) {
          set((s) => {
            const newCryptoPositions = s.cryptoPositions.filter((p) => p.id !== positionId);
            const metrics = calculateAccountMetrics(
              newBalance,
              s.fxPositions,
              s.stockPositions,
              newCryptoPositions
            );
            return {
              balance: newBalance,
              cryptoPositions: newCryptoPositions,
              metrics,
              realizedPnLHistory: [
                ...s.realizedPnLHistory,
                {
                  id: `pnl_${Date.now()}`,
                  type: 'crypto' as const,
                  symbol: position.symbol,
                  pnl: realizedPnL,
                  closedAt: now,
                },
              ],
            };
          });
        } else {
          const newQuantity = position.quantity - quantity;
          set((s) => {
            const newCryptoPositions = s.cryptoPositions.map((p) =>
              p.id === positionId
                ? {
                    ...p,
                    quantity: newQuantity,
                    marketValue: newQuantity * p.currentPrice,
                    costBasis: newQuantity * p.avgBuyPrice,
                    unrealizedPnL: (p.currentPrice - p.avgBuyPrice) * newQuantity,
                    updatedAt: now,
                  }
                : p
            );
            const metrics = calculateAccountMetrics(
              newBalance,
              s.fxPositions,
              s.stockPositions,
              newCryptoPositions
            );
            return {
              balance: newBalance,
              cryptoPositions: newCryptoPositions,
              metrics,
              realizedPnLHistory: [
                ...s.realizedPnLHistory,
                {
                  id: `pnl_${Date.now()}`,
                  type: 'crypto' as const,
                  symbol: position.symbol,
                  pnl: realizedPnL,
                  closedAt: now,
                },
              ],
            };
          });
        }
        
        syncBalanceToSupabase(
          state.userId,
          newBalance,
          proceeds,
          `Crypto Sell: ${quantity} ${position.symbol} @ $${price.toFixed(2)} | P/L: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`
        );
        
        return { success: true, realizedPnL };
      },
      
      updateCryptoPrice: (symbol, price) => {
        set((state) => {
          const newPrices = {
            ...state.cryptoPrices,
            [symbol]: price,
          };
          
          const newCryptoPositions = state.cryptoPositions.map((p) => {
            if (p.symbol === symbol && !p.shieldEnabled) {
              return updateCryptoPositionPrice(p, price);
            }
            return p;
          });
          
          const metrics = calculateAccountMetrics(
            state.balance,
            state.fxPositions,
            state.stockPositions,
            newCryptoPositions
          );
          
          return {
            cryptoPrices: newPrices,
            cryptoPositions: newCryptoPositions,
            metrics,
          };
        });
      },
      
      toggleCryptoShield: (positionId) => {
        set((state) => ({
          cryptoPositions: state.cryptoPositions.map((p) =>
            p.id === positionId
              ? {
                  ...p,
                  shieldEnabled: !p.shieldEnabled,
                  shieldSnapPrice: !p.shieldEnabled ? p.currentPrice : undefined,
                  updatedAt: new Date(),
                }
              : p
          ),
        }));
      },
      
      // ==========================================
      // COMPUTED GETTERS
      // ==========================================
      getMetrics: () => {
        const state = get();
        return calculateAccountMetrics(
          state.balance,
          state.fxPositions,
          state.stockPositions,
          state.cryptoPositions
        );
      },
      
      getTotalEquity: () => {
        const state = get();
        const fxPnL = state.fxPositions.reduce((s, p) => s + p.unrealizedPnL, 0);
        return state.balance + fxPnL;
      },
      
      getTotalUnrealizedPnL: () => {
        const state = get();
        const fxPnL = state.fxPositions.reduce((s, p) => s + p.unrealizedPnL, 0);
        const stockPnL = state.stockPositions.reduce((s, p) => s + p.unrealizedPnL, 0);
        const cryptoPnL = state.cryptoPositions.reduce((s, p) => s + p.unrealizedPnL, 0);
        return fxPnL + stockPnL + cryptoPnL;
      },
      
      getFXPositionBySymbol: (symbol) => {
        return get().fxPositions.find((p) => p.symbol === symbol);
      },
      
      getStockPositionBySymbol: (symbol) => {
        return get().stockPositions.find((p) => p.symbol === symbol);
      },
      
      getCryptoPositionBySymbol: (symbol) => {
        return get().cryptoPositions.find((p) => p.symbol === symbol);
      },
      
      // ==========================================
      // RISK MANAGEMENT - SL/TP CHECK
      // ==========================================
      checkAndExecuteSLTP: () => {
        const state = get();
        
        state.fxPositions.forEach((position) => {
          const prices = state.fxPrices[position.symbol];
          if (!prices) return;
          
          const closePrice = position.side === 'long' ? prices.bid : prices.ask;
          
          // Check Stop Loss
          if (isStopLossTriggered(position.side, closePrice, position.stopLoss)) {
            console.log(`[SLTP] Stop Loss triggered for ${position.symbol}`);
            get().closeFXPosition(position.id, closePrice);
            return;
          }
          
          // Check Take Profit
          if (isTakeProfitTriggered(position.side, closePrice, position.takeProfit)) {
            console.log(`[SLTP] Take Profit triggered for ${position.symbol}`);
            get().closeFXPosition(position.id, closePrice);
            return;
          }
        });
      },
    }),
    {
      name: 'novatrade-unified-trading',
      partialize: (state) => ({
        userId: state.userId,
        balance: state.balance,
        fxPositions: state.fxPositions,
        stockPositions: state.stockPositions,
        cryptoPositions: state.cryptoPositions,
        realizedPnLHistory: state.realizedPnLHistory.slice(-100),
      }),
    }
  )
);

// ==========================================
// CONVENIENCE HOOKS
// ==========================================

export function useFXPositions() {
  return useUnifiedTradingStore((state) => state.fxPositions);
}

export function useStockPositions() {
  return useUnifiedTradingStore((state) => state.stockPositions);
}

export function useCryptoPositions() {
  return useUnifiedTradingStore((state) => state.cryptoPositions);
}

export function useTradingMetrics() {
  return useUnifiedTradingStore((state) => state.metrics);
}

export function useTradingBalance() {
  return useUnifiedTradingStore((state) => state.balance);
}
