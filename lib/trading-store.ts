'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  TradingAccount,
  StockPosition,
  MarginPosition,
  Order,
  Fill,
  LedgerEntry,
  Investment,
  AirdropParticipation,
  Deposit,
  Withdrawal,
  DepositAddress,
  calculateMarginPnL,
  calculateNewAvgEntry,
  calculateRequiredMargin,
  calculateMarginEquity,
  calculateLiquidationPrice,
} from './trading-types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  updateUserBalance,
  syncStockTrade,
  syncFXTrade,
  notifyBalanceUpdate,
} from '@/lib/services/balance-sync';

// ==========================================
// SUPABASE BALANCE SYNC HELPER
// ==========================================

/**
 * Updates the user's balance in Supabase when trades close
 * This is the critical sync between trading P&L and the user's actual balance
 */
async function syncBalanceToSupabase(
  userId: string,
  newBalance: number,
  pnlChange: number,
  description: string
): Promise<boolean> {
  const result = await updateUserBalance(userId, newBalance, pnlChange, description);

  if (result.success && result.newBalance !== undefined) {
    // Notify all listeners that balance has changed
    notifyBalanceUpdate({
      available: result.newBalance,
      bonus: 0, // We don't track bonus here
      totalDeposited: 0,
      timestamp: new Date(),
    });
  }

  return result.success;
}

// ==========================================
// SUPABASE STOCK PORTFOLIO PERSISTENCE
// ==========================================

async function saveStockPortfolioToSupabase(userId: string, state: {
  spotAccount: TradingAccount | null;
  stockPositions: StockPosition[];
  marginPositions: MarginPosition[];
}): Promise<void> {
  if (!isSupabaseConfigured() || !userId) return;
  try {
    const payload = {
      spotAccount: state.spotAccount,
      stockPositions: state.stockPositions,
      marginPositions: state.marginPositions,
    };
    await supabase
      .from('user_trading_data')
      .upsert({
        user_id: userId,
        spot_stocks_state: payload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
  } catch (err) {
    console.warn('[StockTrading] Portfolio save failed:', err);
  }
}

async function loadStockPortfolioFromSupabase(userId: string): Promise<{
  spotAccount: TradingAccount | null;
  stockPositions: StockPosition[];
  marginPositions: MarginPosition[];
} | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_trading_data')
      .select('spot_stocks_state')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data?.spot_stocks_state) return null;
    const s = data.spot_stocks_state as any;
    return {
      spotAccount: s.spotAccount || null,
      stockPositions: s.stockPositions || [],
      marginPositions: s.marginPositions || [],
    };
  } catch {
    return null;
  }
}

// ==========================================
// TRADING ACCOUNT STORE
// ==========================================

interface TradingAccountState {
  // Accounts
  spotAccount: TradingAccount | null;
  marginAccount: TradingAccount | null;

  // Positions
  stockPositions: StockPosition[];
  marginPositions: MarginPosition[];

  // Orders
  openOrders: Order[];
  orderHistory: Order[];
  fills: Fill[];

  // Ledger
  ledger: LedgerEntry[];

  // ✅ Back-compat for your portfolio page
  activeTrades: any[];
  tradeHistory: any[];

  // Account actions
  initializeAccounts: (userId: string, initialBalance?: number) => void;
  loadStocksFromSupabase: (userId: string, fallbackBalance?: number) => Promise<void>;
  updateSpotAccount: (updates: Partial<TradingAccount>) => void;
  updateMarginAccount: (updates: Partial<TradingAccount>) => void;
  syncBalanceFromUser: (balance: number) => void;

  // Admin actions
  adminAdjustBalance: (
    accountType: 'spot' | 'margin',
    amount: number,
    adminId: string,
    note: string
  ) => void;

  // Stock trading (Spot model)
  executeStockBuy: (
    symbol: string,
    name: string,
    qty: number,
    price: number,
    fee: number
  ) => { success: boolean; error?: string };

  executeStockSell: (
    positionId: string,
    qty: number,
    price: number,
    fee: number
  ) => { success: boolean; realizedPnL?: number; error?: string };

  updateStockPositionPrice: (symbol: string, price: number) => void;

  // Margin/FX trading
  openMarginPosition: (
    symbol: string,
    name: string,
    type: 'forex' | 'cfd' | 'crypto',
    side: 'long' | 'short',
    qty: number,
    price: number,
    leverage: number,
    fee: number,
    stopLoss?: number,
    takeProfit?: number
  ) => { success: boolean; error?: string };

  closeMarginPosition: (
    positionId: string,
    price: number,
    fee: number
  ) => { success: boolean; realizedPnL?: number; error?: string };

  reduceMarginPosition: (
    positionId: string,
    qty: number,
    price: number,
    fee: number
  ) => { success: boolean; realizedPnL?: number; error?: string };

  updateMarginPositionPrice: (symbol: string, price: number) => { id: string; symbol: string; side: string; reason: 'sl' | 'tp'; triggerPrice: number; pnl: number }[];

  // Risk management
  checkLiquidation: () => string[];

  // Pending Orders (Limit/Stop)
  placeLimitOrder: (params: {
    symbol: string;
    name: string;
    type: 'forex' | 'cfd' | 'crypto' | 'stock';
    side: 'buy' | 'sell';
    orderType: 'limit' | 'stop' | 'stop_limit';
    qty: number;
    limitPrice: number;
    stopPrice?: number;
    leverage?: number;
    stopLoss?: number;
    takeProfit?: number;
  }) => { success: boolean; orderId?: string; error?: string };

  cancelOrder: (orderId: string) => { success: boolean; error?: string };

  checkPendingOrders: (currentPrices: Record<string, { bid: number; ask: number }>) => void;

  // Swap/Overnight Fees (for FX positions held overnight)
  applySwapFees: (
    swapRates: Record<string, { longSwap: number; shortSwap: number }>
  ) => void;

  // Ledger
  addLedgerEntry: (entry: Omit<LedgerEntry, 'id' | 'createdAt'>) => void;

  // Computed values
  calculateSpotEquity: () => number;
  calculateMarginEquity: () => number;
  calculateTotalUnrealizedPnL: () => number;
}

export const useTradingAccountStore = create<TradingAccountState>()(
  persist(
    (set, get) => ({
      spotAccount: null,
      marginAccount: null,
      stockPositions: [],
      marginPositions: [],
      openOrders: [],
      orderHistory: [],
      fills: [],
      ledger: [],

      // ✅ back-compat
      activeTrades: [],
      tradeHistory: [],

      initializeAccounts: (userId, initialBalance = 0) => {
        const now = new Date();
        const balance = Number(initialBalance) || 0;

        // ✅ CRITICAL: If userId changed, clear stale data from previous user
        const currentSpot = get().spotAccount;
        if (currentSpot && currentSpot.userId && currentSpot.userId !== userId) {
          set({ stockPositions: [], marginPositions: [], ledger: [] });
        }

        const spotAccount: TradingAccount = {
          id: `spot_${userId}`,
          userId,
          type: 'spot',
          cash: balance,
          equity: balance,
          availableToTrade: balance,
          availableToWithdraw: balance,
          balance: balance,
          marginUsed: 0,
          freeMargin: balance,
          leverage: 1,
          unrealizedPnL: 0,
          realizedPnL: 0,
          totalPnL: 0,
          currency: 'USD',
          createdAt: now,
          updatedAt: now,
        };

        const marginAccount: TradingAccount = {
          id: `margin_${userId}`,
          userId,
          type: 'margin',
          cash: balance,
          equity: balance,
          availableToTrade: balance,
          availableToWithdraw: balance,
          balance: balance,
          marginUsed: 0,
          freeMargin: balance,
          leverage: 100,
          marginLevel: undefined,
          unrealizedPnL: 0,
          realizedPnL: 0,
          totalPnL: 0,
          currency: 'USD',
          createdAt: now,
          updatedAt: now,
        };

        set({ spotAccount, marginAccount });
      },

      // Load stock/FX positions from Supabase (cross-device sync)
      loadStocksFromSupabase: async (userId, fallbackBalance = 0) => {
        const remote = await loadStockPortfolioFromSupabase(userId);
        if (remote && remote.stockPositions && remote.stockPositions.length > 0) {
          const balance = Number(fallbackBalance) || 0;
          const account = remote.spotAccount || get().spotAccount;
          if (account) {
            account.cash = balance;
            account.balance = balance;
            account.availableToTrade = balance;
          }
          set({
            spotAccount: account,
            stockPositions: remote.stockPositions,
            marginPositions: remote.marginPositions || [],
          });
          return;
        }
        // If no remote data but local has data for same user, sync local up
        const local = get();
        if (local.spotAccount && local.spotAccount.userId === userId && local.stockPositions.length > 0) {
          saveStockPortfolioToSupabase(userId, {
            spotAccount: local.spotAccount,
            stockPositions: local.stockPositions,
            marginPositions: local.marginPositions,
          });
        }
      },

      updateSpotAccount: (updates) => {
        set((state) => ({
          spotAccount: state.spotAccount
            ? { ...state.spotAccount, ...updates, updatedAt: new Date() }
            : null,
        }));
      },

      updateMarginAccount: (updates) => {
        set((state) => ({
          marginAccount: state.marginAccount
            ? { ...state.marginAccount, ...updates, updatedAt: new Date() }
            : null,
        }));
      },

      syncBalanceFromUser: (balance: number) => {
        const state = get();
        const now = new Date();

        // ✅ FIX: StockPosition has marketValue, not currentValue
        const spotPositionValue = state.stockPositions.reduce(
          (sum, p) => sum + (p.marketValue || 0),
          0
        );

        const marginUsed = state.marginAccount?.marginUsed || 0;
        const unrealizedPnL = state.marginPositions.reduce(
          (sum, p) => sum + (p.unrealizedPnL || 0),
          0
        );

        if (state.spotAccount) {
          const availableToTrade = Math.max(0, balance - spotPositionValue);
          set((state) => ({
            spotAccount: state.spotAccount
              ? {
                  ...state.spotAccount,
                  cash: balance,
                  balance: balance,
                  equity: balance + spotPositionValue,
                  availableToTrade,
                  availableToWithdraw: availableToTrade,
                  freeMargin: availableToTrade,
                  updatedAt: now,
                }
              : null,
          }));
        }

        if (state.marginAccount) {
          const equity = balance + unrealizedPnL;
          const freeMargin = Math.max(0, equity - marginUsed);
          set((state) => ({
            marginAccount: state.marginAccount
              ? {
                  ...state.marginAccount,
                  cash: balance,
                  balance: balance,
                  equity,
                  availableToTrade: freeMargin,
                  availableToWithdraw: Math.max(0, balance - marginUsed),
                  freeMargin,
                  marginLevel: marginUsed > 0 ? (equity / marginUsed) * 100 : undefined,
                  updatedAt: now,
                }
              : null,
          }));
        }
      },

      adminAdjustBalance: (accountType, amount, adminId, note) => {
        const state = get();
        const account = accountType === 'spot' ? state.spotAccount : state.marginAccount;

        if (!account) return;

        const entry: LedgerEntry = {
          id: `ledger_${Date.now()}`,
          accountId: account.id,
          type: 'adjustment',
          amount,
          balanceBefore: account.cash,
          balanceAfter: account.cash + amount,
          description: `Admin adjustment: ${note}`,
          adminId,
          adminNote: note,
          createdAt: new Date(),
        };

        if (accountType === 'spot') {
          set((state) => ({
            spotAccount: state.spotAccount
              ? {
                  ...state.spotAccount,
                  cash: state.spotAccount.cash + amount,
                  equity: state.spotAccount.equity + amount,
                  availableToTrade: state.spotAccount.availableToTrade + amount,
                  updatedAt: new Date(),
                }
              : null,
            ledger: [...state.ledger, entry],
            tradeHistory: [...state.tradeHistory, entry],
          }));
        } else {
          set((state) => ({
            marginAccount: state.marginAccount
              ? {
                  ...state.marginAccount,
                  balance: state.marginAccount.balance + amount,
                  cash: state.marginAccount.cash + amount,
                  freeMargin: state.marginAccount.freeMargin + amount,
                  updatedAt: new Date(),
                }
              : null,
            ledger: [...state.ledger, entry],
            tradeHistory: [...state.tradeHistory, entry],
          }));
        }
      },

      // STOCK TRADING (SPOT MODEL)
      executeStockBuy: (symbol, name, qty, price, fee) => {
        const state = get();
        const account = state.spotAccount;

        if (!account) return { success: false, error: 'Account not initialized' };

        const cost = qty * price + fee;

        if (cost > account.cash) {
          return { success: false, error: 'Insufficient funds' };
        }

        const newCash = account.cash - cost;
        const existingPosition = state.stockPositions.find((p) => p.symbol === symbol);
        const now = new Date();

        if (existingPosition) {
          const newAvg = calculateNewAvgEntry(
            existingPosition.qty,
            existingPosition.avgEntry,
            qty,
            price,
            fee
          );

          set((state) => {
            const nextStockPositions = state.stockPositions.map((p) =>
              p.symbol === symbol
                ? {
                    ...p,
                    qty: p.qty + qty,
                    avgEntry: newAvg,
                    marketValue: (p.qty + qty) * p.currentPrice,
                    unrealizedPnL: (p.currentPrice - newAvg) * (p.qty + qty),
                    updatedAt: now,
                  }
                : p
            );

            return {
              spotAccount: state.spotAccount
                ? {
                    ...state.spotAccount,
                    cash: newCash,
                    balance: newCash,
                    availableToTrade: newCash,
                    updatedAt: now,
                  }
                : null,
              stockPositions: nextStockPositions,
              activeTrades: [...nextStockPositions, ...state.marginPositions],
            };
          });
        } else {
          const avgEntryWithFee = (qty * price + fee) / qty;
          const newPosition: StockPosition = {
            id: `stock_${Date.now()}`,
            accountId: account.id,
            symbol,
            name,
            type: 'stock',
            qty,
            avgEntry: avgEntryWithFee,
            currentPrice: price,
            marketValue: qty * price,
            unrealizedPnL: -fee,
            unrealizedPnLPercent: (-fee / (qty * price)) * 100,
            openedAt: now,
            updatedAt: now,
          };

          set((state) => {
            const nextStockPositions = [...state.stockPositions, newPosition];
            return {
              spotAccount: state.spotAccount
                ? {
                    ...state.spotAccount,
                    cash: newCash,
                    balance: newCash,
                    availableToTrade: newCash,
                    updatedAt: now,
                  }
                : null,
              stockPositions: nextStockPositions,
              activeTrades: [...nextStockPositions, ...state.marginPositions],
            };
          });
        }

        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_open',
          amount: -cost,
          balanceBefore: account.cash,
          balanceAfter: newCash,
          referenceId: symbol,
          referenceType: 'stock_buy',
          description: `Buy ${qty} ${symbol} @ $${price.toFixed(2)}`,
        });

        syncBalanceToSupabase(account.userId, newCash, -cost, `Stock Buy: ${qty} ${symbol}`);

        // 🔥 CRITICAL: Persist stock positions to Supabase for cross-device sync
        const afterBuy = get();
        saveStockPortfolioToSupabase(account.userId, {
          spotAccount: afterBuy.spotAccount,
          stockPositions: afterBuy.stockPositions,
          marginPositions: afterBuy.marginPositions,
        });

        return { success: true };
      },

      executeStockSell: (positionId, qty, price, fee) => {
        const state = get();
        const account = state.spotAccount;
        const position = state.stockPositions.find((p) => p.id === positionId);

        if (!account) return { success: false, error: 'Account not initialized' };
        if (!position) return { success: false, error: 'Position not found' };
        if (qty > position.qty) return { success: false, error: 'Quantity exceeds position' };

        const grossPnL = (price - position.avgEntry) * qty;
        const realizedPnL = grossPnL - fee;
        const proceeds = qty * price - fee;
        const newCash = account.cash + proceeds;
        const now = new Date();

        if (qty === position.qty) {
          set((state) => {
            const nextStockPositions = state.stockPositions.filter((p) => p.id !== positionId);
            return {
              spotAccount: state.spotAccount
                ? {
                    ...state.spotAccount,
                    cash: newCash,
                    balance: newCash,
                    availableToTrade: newCash,
                    realizedPnL: state.spotAccount.realizedPnL + realizedPnL,
                    updatedAt: now,
                  }
                : null,
              stockPositions: nextStockPositions,
              activeTrades: [...nextStockPositions, ...state.marginPositions],
            };
          });
        } else {
          set((state) => {
            const nextStockPositions = state.stockPositions.map((p) =>
              p.id === positionId
                ? {
                    ...p,
                    qty: p.qty - qty,
                    marketValue: (p.qty - qty) * p.currentPrice,
                    unrealizedPnL: (p.currentPrice - p.avgEntry) * (p.qty - qty),
                    updatedAt: now,
                  }
                : p
            );

            return {
              spotAccount: state.spotAccount
                ? {
                    ...state.spotAccount,
                    cash: newCash,
                    balance: newCash,
                    availableToTrade: newCash,
                    realizedPnL: state.spotAccount.realizedPnL + realizedPnL,
                    updatedAt: now,
                  }
                : null,
              stockPositions: nextStockPositions,
              activeTrades: [...nextStockPositions, ...state.marginPositions],
            };
          });
        }

        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_close',
          amount: proceeds,
          balanceBefore: account.cash,
          balanceAfter: newCash,
          referenceId: positionId,
          referenceType: 'stock_sell',
          description: `Sell ${qty} ${position.symbol} @ $${price.toFixed(
            2
          )} | PnL: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`,
        });

        syncBalanceToSupabase(
          account.userId,
          newCash,
          realizedPnL,
          `Stock Sell: ${qty} ${position.symbol}`
        );

        // 🔥 CRITICAL: Persist stock positions to Supabase for cross-device sync
        const afterSell = get();
        saveStockPortfolioToSupabase(account.userId, {
          spotAccount: afterSell.spotAccount,
          stockPositions: afterSell.stockPositions,
          marginPositions: afterSell.marginPositions,
        });

        return { success: true, realizedPnL };
      },

      updateStockPositionPrice: (symbol, price) => {
        set((state) => {
          const nextStockPositions = state.stockPositions.map((p) =>
            p.symbol === symbol
              ? {
                  ...p,
                  currentPrice: price,
                  marketValue: p.qty * price,
                  unrealizedPnL: (price - p.avgEntry) * p.qty,
                  unrealizedPnLPercent: ((price - p.avgEntry) / p.avgEntry) * 100,
                  updatedAt: new Date(),
                }
              : p
          );

          return {
            stockPositions: nextStockPositions,
            activeTrades: [...nextStockPositions, ...state.marginPositions],
          };
        });
      },

      // MARGIN/FX TRADING
      openMarginPosition: (
        symbol,
        name,
        type,
        side,
        qty,
        price,
        leverage,
        fee,
        stopLoss,
        takeProfit
      ) => {
        const state = get();
        const account = state.marginAccount;

        if (!account) return { success: false, error: 'Account not initialized' };

        const notional = qty * price;
        const requiredMargin = calculateRequiredMargin(qty, price, leverage);

        if (requiredMargin > account.freeMargin) {
          return { success: false, error: 'Insufficient margin' };
        }

        const newBalance = account.balance - fee;
        const now = new Date();

        const newPosition: MarginPosition = {
          id: `margin_${Date.now()}`,
          accountId: account.id,
          symbol,
          name,
          type,
          side,
          qty,
          avgEntry: price,
          leverage,
          notional,
          requiredMargin,
          maintenanceMargin: requiredMargin * 0.5,
          stopLoss,
          takeProfit,
          currentPrice: price,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          openingFee: fee,
          accumulatedFunding: 0,
          openedAt: now,
          updatedAt: now,
        };

        const equity = calculateMarginEquity(newBalance, 0, 0, 0);
        newPosition.liquidationPrice = calculateLiquidationPrice(newPosition, equity, 0.5);

        set((state) => {
          const nextMarginPositions = [...state.marginPositions, newPosition];
          const newMarginUsed = state.marginAccount!.marginUsed + requiredMargin;

          const currentUnrealizedPnL = state.marginPositions.reduce(
            (sum, p) => sum + (p.unrealizedPnL || 0),
            0
          );
          const newEquity = newBalance + currentUnrealizedPnL;
          const newFreeMargin = newEquity - newMarginUsed;
          const newMarginLevel =
            newMarginUsed > 0 ? (newEquity / newMarginUsed) * 100 : undefined;

          return {
            marginAccount: state.marginAccount
              ? {
                  ...state.marginAccount,
                  balance: newBalance,
                  cash: newBalance,
                  equity: newEquity,
                  marginUsed: newMarginUsed,
                  freeMargin: newFreeMargin,
                  marginLevel: newMarginLevel,
                  updatedAt: now,
                }
              : null,
            marginPositions: nextMarginPositions,
            activeTrades: [...state.stockPositions, ...nextMarginPositions],
          };
        });

        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_open',
          amount: -fee,
          balanceBefore: account.balance,
          balanceAfter: newBalance,
          referenceId: newPosition.id,
          referenceType: 'margin_open',
          description: `Open ${side.toUpperCase()} ${qty} ${symbol} @ ${price} (${leverage}x)`,
        });

        if (fee > 0) {
          syncBalanceToSupabase(
            account.userId,
            newBalance,
            -fee,
            `FX Open Fee: ${symbol} ${side.toUpperCase()}`
          );
        }

        return { success: true };
      },

      closeMarginPosition: (positionId, price, fee) => {
        const state = get();
        const account = state.marginAccount;
        const position = state.marginPositions.find((p) => p.id === positionId);

        if (!account) return { success: false, error: 'Account not initialized' };
        if (!position) return { success: false, error: 'Position not found' };

        const realizedPnL = calculateMarginPnL(position, price);
        const newBalance = account.balance + realizedPnL - fee;
        const now = new Date();

        set((state) => {
          const nextMarginPositions = state.marginPositions.filter((p) => p.id !== positionId);

          return {
            marginAccount: state.marginAccount
              ? {
                  ...state.marginAccount,
                  balance: newBalance,
                  cash: newBalance,
                  marginUsed: state.marginAccount.marginUsed - position.requiredMargin,
                  freeMargin: newBalance - (state.marginAccount.marginUsed - position.requiredMargin),
                  equity: newBalance,
                  realizedPnL: state.marginAccount.realizedPnL + realizedPnL,
                  unrealizedPnL: state.marginAccount.unrealizedPnL - position.unrealizedPnL,
                  updatedAt: now,
                }
              : null,
            marginPositions: nextMarginPositions,
            activeTrades: [...state.stockPositions, ...nextMarginPositions],
          };
        });

        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_close',
          amount: realizedPnL - fee,
          balanceBefore: account.balance,
          balanceAfter: newBalance,
          referenceId: positionId,
          referenceType: 'margin_close',
          description: `Close ${position.side.toUpperCase()} ${position.qty} ${
            position.symbol
          } @ ${price} | PnL: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`,
        });

        syncBalanceToSupabase(
          account.userId,
          newBalance,
          realizedPnL - fee,
          `FX Close: ${position.symbol} ${position.side.toUpperCase()}`
        );

        return { success: true, realizedPnL };
      },

      reduceMarginPosition: (positionId, qty, price, fee) => {
        const state = get();
        const account = state.marginAccount;
        const position = state.marginPositions.find((p) => p.id === positionId);

        if (!account) return { success: false, error: 'Account not initialized' };
        if (!position) return { success: false, error: 'Position not found' };
        if (qty >= position.qty) {
          return get().closeMarginPosition(positionId, price, fee);
        }

        const ratio = qty / position.qty;
        const realizedPnL = calculateMarginPnL({ ...position, qty }, price);
        const marginReleased = position.requiredMargin * ratio;
        const newBalance = account.balance + realizedPnL - fee;
        const now = new Date();

        set((state) => {
          const nextMarginPositions = state.marginPositions.map((p) =>
            p.id === positionId
              ? {
                  ...p,
                  qty: p.qty - qty,
                  notional: (p.qty - qty) * p.avgEntry,
                  requiredMargin: p.requiredMargin - marginReleased,
                  maintenanceMargin: (p.requiredMargin - marginReleased) * 0.5,
                  updatedAt: now,
                }
              : p
          );

          return {
            marginAccount: state.marginAccount
              ? {
                  ...state.marginAccount,
                  balance: newBalance,
                  cash: newBalance,
                  marginUsed: state.marginAccount.marginUsed - marginReleased,
                  freeMargin: newBalance - (state.marginAccount.marginUsed - marginReleased),
                  equity: newBalance + (state.marginAccount.unrealizedPnL || 0),
                  realizedPnL: state.marginAccount.realizedPnL + realizedPnL,
                  updatedAt: now,
                }
              : null,
            marginPositions: nextMarginPositions,
            activeTrades: [...state.stockPositions, ...nextMarginPositions],
          };
        });

        syncBalanceToSupabase(
          account.userId,
          newBalance,
          realizedPnL - fee,
          `FX Partial Close: ${position.symbol} (${qty} units)`
        );

        return { success: true, realizedPnL };
      },

      updateMarginPositionPrice: (symbol, price) => {
        const slTpTriggered: { id: string; symbol: string; side: string; reason: 'sl' | 'tp'; triggerPrice: number; pnl: number }[] = [];

        set((state) => {
          const updatedPositions = state.marginPositions.map((p) => {
            if (p.symbol !== symbol) return p;
            const unrealizedPnL = calculateMarginPnL(p, price);

            // --- SL/TP detection ---
            const side = (p as any).side as string;
            const isLong = side === 'long';

            // Stop Loss check
            if (p.stopLoss != null && Number.isFinite(p.stopLoss)) {
              const slHit = isLong ? price <= p.stopLoss : price >= p.stopLoss;
              if (slHit) {
                const slPnl = calculateMarginPnL(p, p.stopLoss);
                slTpTriggered.push({ id: p.id, symbol: p.symbol, side, reason: 'sl', triggerPrice: p.stopLoss, pnl: slPnl });
              }
            }

            // Take Profit check
            if (p.takeProfit != null && Number.isFinite(p.takeProfit)) {
              const tpHit = isLong ? price >= p.takeProfit : price <= p.takeProfit;
              if (tpHit) {
                const tpPnl = calculateMarginPnL(p, p.takeProfit);
                slTpTriggered.push({ id: p.id, symbol: p.symbol, side, reason: 'tp', triggerPrice: p.takeProfit, pnl: tpPnl });
              }
            }

            return {
              ...p,
              currentPrice: price,
              unrealizedPnL,
              unrealizedPnLPercent: (unrealizedPnL / p.requiredMargin) * 100,
              updatedAt: new Date(),
            };
          });

          const totalUnrealizedPnL = updatedPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

          return {
            marginPositions: updatedPositions,
            activeTrades: [...state.stockPositions, ...updatedPositions],
            marginAccount: state.marginAccount
              ? {
                  ...state.marginAccount,
                  unrealizedPnL: totalUnrealizedPnL,
                  equity: state.marginAccount.balance + totalUnrealizedPnL,
                  marginLevel:
                    state.marginAccount.marginUsed > 0
                      ? ((state.marginAccount.balance + totalUnrealizedPnL) /
                          state.marginAccount.marginUsed) *
                        100
                      : undefined,
                }
              : null,
          };
        });

        // Return triggered SL/TP info so callers can handle auto-close
        return slTpTriggered;
      },

      checkLiquidation: () => {
        const state = get();
        const account = state.marginAccount;
        if (!account || state.marginPositions.length === 0) return [];

        const totalUnrealizedPnL = state.marginPositions.reduce(
          (sum, p) => sum + (p.unrealizedPnL || 0),
          0
        );
        const totalUsedMargin = state.marginPositions.reduce(
          (sum, p) => sum + (p.requiredMargin || 0),
          0
        );
        const totalMaintenanceMargin = state.marginPositions.reduce(
          (sum, p) => sum + (p.maintenanceMargin || p.requiredMargin * 0.5),
          0
        );

        const accountEquity = account.balance + totalUnrealizedPnL;
        const marginLevelPercent = totalUsedMargin > 0 ? (accountEquity / totalUsedMargin) * 100 : Infinity;

        const positionsToLiquidate: string[] = [];

        if (accountEquity <= totalMaintenanceMargin || marginLevelPercent < 50) {
          const sortedPositions = [...state.marginPositions].sort(
            (a, b) => (a.unrealizedPnL || 0) - (b.unrealizedPnL || 0)
          );

          let remainingEquity = accountEquity;
          let remainingMargin = totalUsedMargin;

          for (const position of sortedPositions) {
            if (remainingMargin > 0 && (remainingEquity / remainingMargin) * 100 < 100) {
              positionsToLiquidate.push(position.id);
              remainingMargin -= position.requiredMargin;
              remainingEquity -= position.unrealizedPnL;
            }
          }
        }

        return positionsToLiquidate;
      },

      placeLimitOrder: (params) => {
        const state = get();
        const { symbol, name, type, side, orderType, qty, limitPrice, stopPrice, leverage, stopLoss, takeProfit } =
          params;

        const isStock = type === 'stock';
        const account = isStock ? state.spotAccount : state.marginAccount;

        if (!account) return { success: false, error: 'Account not initialized' };

        let requiredAmount: number;
        if (isStock) {
          requiredAmount = qty * limitPrice;
          if (requiredAmount > (account.cash || 0)) {
            return { success: false, error: 'Insufficient funds for limit order' };
          }
        } else {
          const effectiveLeverage = leverage || account.leverage || 100;
          requiredAmount = (qty * limitPrice) / effectiveLeverage;
          if (requiredAmount > (account.freeMargin || 0)) {
            return { success: false, error: 'Insufficient margin for limit order' };
          }
        }

        const now = new Date();
        const newOrder: Order = {
          id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          accountId: account.id,
          symbol,
          type: orderType,
          side,
          qty,
          price: limitPrice,
          stopPrice: stopPrice,
          filledQty: 0,
          status: 'pending',
          stopLoss,
          takeProfit,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          openOrders: [...state.openOrders, newOrder],
        }));

        return { success: true, orderId: newOrder.id };
      },

      cancelOrder: (orderId) => {
        const state = get();
        const order = state.openOrders.find((o) => o.id === orderId);

        if (!order) return { success: false, error: 'Order not found' };
        if (order.status !== 'pending' && order.status !== 'open') {
          return { success: false, error: 'Order cannot be cancelled' };
        }

        const now = new Date();
        const cancelledOrder: Order = {
          ...order,
          status: 'cancelled',
          cancelledAt: now,
          updatedAt: now,
        };

        set((state) => ({
          openOrders: state.openOrders.filter((o) => o.id !== orderId),
          orderHistory: [cancelledOrder, ...state.orderHistory],
        }));

        return { success: true };
      },

      checkPendingOrders: (currentPrices) => {
        const state = get();
        const ordersToFill: Order[] = [];

        state.openOrders.forEach((order) => {
          if (order.status !== 'pending' && order.status !== 'open') return;

          const priceData = currentPrices[order.symbol];
          if (!priceData) return;

          const { bid, ask } = priceData;
          let shouldFill = false;
          let fillPrice = 0;

          switch (order.type) {
            case 'limit':
              if (order.side === 'buy' && ask <= (order.price || 0)) {
                shouldFill = true;
                fillPrice = order.price || ask;
              } else if (order.side === 'sell' && bid >= (order.price || 0)) {
                shouldFill = true;
                fillPrice = order.price || bid;
              }
              break;

            case 'stop':
              if (order.side === 'buy' && ask >= (order.stopPrice || 0)) {
                shouldFill = true;
                fillPrice = ask;
              } else if (order.side === 'sell' && bid <= (order.stopPrice || 0)) {
                shouldFill = true;
                fillPrice = bid;
              }
              break;

            case 'stop_limit':
              if (
                order.side === 'buy' &&
                ask >= (order.stopPrice || 0) &&
                ask <= (order.price || 0)
              ) {
                shouldFill = true;
                fillPrice = order.price || ask;
              } else if (
                order.side === 'sell' &&
                bid <= (order.stopPrice || 0) &&
                bid >= (order.price || 0)
              ) {
                shouldFill = true;
                fillPrice = order.price || bid;
              }
              break;
          }

          if (shouldFill) {
            ordersToFill.push({ ...order, avgFillPrice: fillPrice });
          }
        });

        ordersToFill.forEach((order) => {
          const fillPrice = order.avgFillPrice || order.price || 0;

          set((state) => ({
            openOrders: state.openOrders.filter((o) => o.id !== order.id),
          }));

          console.log(
            `[Trading] Limit order filled: ${order.side} ${order.qty} ${order.symbol} @ ${fillPrice}`
          );

          const filledOrder: Order = {
            ...order,
            status: 'filled',
            filledQty: order.qty,
            avgFillPrice: fillPrice,
            filledAt: new Date(),
            updatedAt: new Date(),
          };

          set((state) => ({
            orderHistory: [filledOrder, ...state.orderHistory],
          }));
        });
      },

      applySwapFees: (swapRates) => {
        const state = get();
        const account = state.marginAccount;
        if (!account || state.marginPositions.length === 0) return;

        let totalSwapCharged = 0;
        const now = new Date();

        const updatedPositions = state.marginPositions.map((position) => {
          const rates = swapRates[position.symbol];
          if (!rates) return position;

          const lots = position.qty / 100000;
          const swapRate = position.side === 'long' ? rates.longSwap : rates.shortSwap;
          const swapAmount = lots * swapRate;

          totalSwapCharged += swapAmount;

          return {
            ...position,
            accumulatedFunding: (position.accumulatedFunding || 0) + swapAmount,
            updatedAt: now,
          };
        });

        if (totalSwapCharged !== 0) {
          const newBalance = account.balance - totalSwapCharged;
          const totalUnrealizedPnL = updatedPositions.reduce(
            (sum, p) => sum + (p.unrealizedPnL || 0),
            0
          );

          set({
            marginPositions: updatedPositions,
            activeTrades: [...get().stockPositions, ...updatedPositions],
            marginAccount: {
              ...account,
              balance: newBalance,
              cash: newBalance,
              equity: newBalance + totalUnrealizedPnL,
              freeMargin: newBalance + totalUnrealizedPnL - account.marginUsed,
              updatedAt: now,
            },
          });

          get().addLedgerEntry({
            accountId: account.id,
            type: 'funding',
            amount: -totalSwapCharged,
            balanceBefore: account.balance,
            balanceAfter: newBalance,
            description: `Overnight swap fees: ${totalSwapCharged >= 0 ? '-' : '+'}$${Math.abs(
              totalSwapCharged
            ).toFixed(2)}`,
          });

          console.log(`[Trading] Swap fees applied: $${totalSwapCharged.toFixed(2)}`);
        }
      },

      addLedgerEntry: (entry) => {
        const newEntry: LedgerEntry = {
          ...entry,
          id: `ledger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
        };

        set((state) => ({
          ledger: [newEntry, ...state.ledger],
          tradeHistory: [newEntry, ...state.tradeHistory],
        }));
      },

      calculateSpotEquity: () => {
        const state = get();
        const account = state.spotAccount;
        if (!account) return 0;

        const marketValue = state.stockPositions.reduce((sum, p) => sum + p.marketValue, 0);
        return account.cash + marketValue;
      },

      calculateMarginEquity: () => {
        const state = get();
        const account = state.marginAccount;
        if (!account) return 0;

        return calculateMarginEquity(account.balance, account.unrealizedPnL, 0, 0);
      },

      calculateTotalUnrealizedPnL: () => {
        const state = get();

        const stockPnL = state.stockPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
        const marginPnL = state.marginPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

        return stockPnL + marginPnL;
      },
    }),
    {
      name: 'novatrade-trading-accounts',
      partialize: (state) => ({
        spotAccount: state.spotAccount,
        marginAccount: state.marginAccount,
        stockPositions: state.stockPositions,
        marginPositions: state.marginPositions,
        ledger: state.ledger.slice(0, 100),
      }),
    }
  )
);

// ==========================================
// INVESTMENTS STORE
// ==========================================

interface InvestmentsState {
  investments: Investment[];
  totalInvested: number;
  totalEarned: number;

  createInvestment: (investment: Omit<Investment, 'id' | 'createdAt'>) => void;
  updateInvestmentValue: (id: string, newValue: number, earned: number) => void;
  completeInvestment: (id: string) => void;
}

export const useInvestmentsStore = create<InvestmentsState>()(
  persist(
    (set, get) => ({
      investments: [],
      totalInvested: 0,
      totalEarned: 0,

      createInvestment: (investment) => {
        const newInvestment: Investment = {
          ...investment,
          id: `inv_${Date.now()}`,
          createdAt: new Date(),
        };

        set((state) => ({
          investments: [...state.investments, newInvestment],
          totalInvested: state.totalInvested + investment.principal,
        }));
      },

      updateInvestmentValue: (id, newValue, earned) => {
        set((state) => ({
          investments: state.investments.map((inv) =>
            inv.id === id
              ? { ...inv, currentValue: newValue, totalEarned: inv.totalEarned + earned }
              : inv
          ),
          totalEarned: state.totalEarned + earned,
        }));
      },

      completeInvestment: (id) => {
        set((state) => ({
          investments: state.investments.map((inv) =>
            inv.id === id ? { ...inv, status: 'completed' } : inv
          ),
        }));
      },
    }),
    {
      name: 'novatrade-investments',
    }
  )
);

// ==========================================
// AIRDROPS STORE
// ==========================================

interface AirdropsState {
  participations: AirdropParticipation[];
  totalPointsEarned: number;

  joinAirdrop: (airdropId: string, airdropName: string, totalTasks: number) => void;
  completeTask: (participationId: string, taskId: string, points: number) => void;
  claimAirdrop: (participationId: string) => void;
}

export const useAirdropsStore = create<AirdropsState>()(
  persist(
    (set) => ({
      participations: [],
      totalPointsEarned: 0,

      joinAirdrop: (airdropId, airdropName, totalTasks) => {
        const participation: AirdropParticipation = {
          id: `airdrop_${Date.now()}`,
          userId: '',
          airdropId,
          airdropName,
          tasksCompleted: [],
          totalTasks,
          pointsEarned: 0,
          status: 'active',
          createdAt: new Date(),
        };

        set((state) => ({
          participations: [...state.participations, participation],
        }));
      },

      completeTask: (participationId, taskId, points) => {
        set((state) => ({
          participations: state.participations.map((p) =>
            p.id === participationId
              ? {
                  ...p,
                  tasksCompleted: [...p.tasksCompleted, taskId],
                  pointsEarned: p.pointsEarned + points,
                  status: p.tasksCompleted.length + 1 >= p.totalTasks ? 'completed' : 'active',
                }
              : p
          ),
          totalPointsEarned: state.totalPointsEarned + points,
        }));
      },

      claimAirdrop: (participationId) => {
        set((state) => ({
          participations: state.participations.map((p) =>
            p.id === participationId ? { ...p, status: 'claimed', claimedAt: new Date() } : p
          ),
        }));
      },
    }),
    {
      name: 'novatrade-airdrops',
    }
  )
);

// ==========================================
// DEPOSIT ADDRESSES STORE (Admin Controlled)
// ==========================================

interface DepositAddressesState {
  addresses: DepositAddress[];

  getAddress: (currency: string, network: string) => DepositAddress | undefined;
  updateAddress: (id: string, newAddress: string, adminId: string) => void;
  addAddress: (address: Omit<DepositAddress, 'id' | 'updatedAt'>) => void;
  toggleActive: (id: string) => void;
}

export const useDepositAddressesStore = create<DepositAddressesState>()(
  persist(
    (set, get) => ({
      addresses: [
        {
          id: 'btc_mainnet',
          currency: 'BTC',
          network: 'Bitcoin',
          address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: 'eth_erc20',
          currency: 'ETH',
          network: 'ERC-20',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEa1',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: 'usdt_trc20',
          currency: 'USDT',
          network: 'TRC-20',
          address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: 'usdt_erc20',
          currency: 'USDT',
          network: 'ERC-20',
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEa1',
          isActive: true,
          updatedAt: new Date(),
        },
        {
          id: 'sol_solana',
          currency: 'SOL',
          network: 'Solana',
          address: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
          isActive: true,
          updatedAt: new Date(),
        },
      ],

      getAddress: (currency, network) => {
        return get().addresses.find(
          (a) => a.currency === currency && a.network === network && a.isActive
        );
      },

      updateAddress: (id, newAddress, adminId) => {
        set((state) => ({
          addresses: state.addresses.map((a) =>
            a.id === id ? { ...a, address: newAddress, updatedBy: adminId, updatedAt: new Date() } : a
          ),
        }));
      },

      addAddress: (address) => {
        const newAddressObj: DepositAddress = {
          ...address,
          id: `${address.currency.toLowerCase()}_${address.network.toLowerCase()}_${Date.now()}`,
          updatedAt: new Date(),
        };

        set((state) => ({
          addresses: [...state.addresses, newAddressObj],
        }));
      },

      toggleActive: (id) => {
        set((state) => ({
          addresses: state.addresses.map((a) =>
            a.id === id ? { ...a, isActive: !a.isActive, updatedAt: new Date() } : a
          ),
        }));
      },
    }),
    {
      name: 'novatrade-deposit-addresses',
    }
  )
);
