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
  notifyBalanceUpdate 
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
  
  // Account actions
  initializeAccounts: (userId: string, initialBalance?: number) => void;
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
  
  updateMarginPositionPrice: (symbol: string, price: number) => void;
  
  // Risk management
  checkLiquidation: () => string[];  // Returns position IDs to liquidate
  
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
  applySwapFees: (swapRates: Record<string, { longSwap: number; shortSwap: number }>) => void;
  
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
      
      initializeAccounts: (userId, initialBalance = 0) => {
        const now = new Date();
        const balance = Number(initialBalance) || 0;
        
        // Accounts start with user's balance from Supabase
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
        
        // Margin account also gets the same balance
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
        
        // Calculate the difference from current positions/margin
        const spotPositionValue = state.stockPositions.reduce(
          (sum, p) => sum + p.currentValue, 0
        );
        const marginUsed = state.marginAccount?.marginUsed || 0;
        const unrealizedPnL = state.marginPositions.reduce(
          (sum, p) => sum + (p.unrealizedPnL || 0), 0
        );
        
        // Update spot account
        if (state.spotAccount) {
          const availableToTrade = Math.max(0, balance - spotPositionValue);
          set((state) => ({
            spotAccount: state.spotAccount ? {
              ...state.spotAccount,
              cash: balance,
              balance: balance,
              equity: balance + spotPositionValue,
              availableToTrade,
              availableToWithdraw: availableToTrade,
              freeMargin: availableToTrade,
              updatedAt: now,
            } : null,
          }));
        }
        
        // Update margin account
        if (state.marginAccount) {
          const equity = balance + unrealizedPnL;
          const freeMargin = Math.max(0, equity - marginUsed);
          set((state) => ({
            marginAccount: state.marginAccount ? {
              ...state.marginAccount,
              cash: balance,
              balance: balance,
              equity,
              availableToTrade: freeMargin,
              availableToWithdraw: Math.max(0, balance - marginUsed),
              freeMargin,
              marginLevel: marginUsed > 0 ? (equity / marginUsed) * 100 : undefined,
              updatedAt: now,
            } : null,
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
          }));
        }
      },
      
      // STOCK TRADING (SPOT MODEL)
      executeStockBuy: (symbol, name, qty, price, fee) => {
        const state = get();
        const account = state.spotAccount;
        
        if (!account) return { success: false, error: 'Account not initialized' };
        
        // Stock cost: total = qty * price + fee
        const cost = qty * price + fee;
        
        if (cost > account.cash) {
          return { success: false, error: 'Insufficient funds' };
        }
        
        const newCash = account.cash - cost;
        const existingPosition = state.stockPositions.find(p => p.symbol === symbol);
        const now = new Date();
        
        if (existingPosition) {
          // Update existing position with weighted average
          // Formula: new_avg = (q_old*avg_old + q_buy*buy_price + fee) / new_q
          const newAvg = calculateNewAvgEntry(
            existingPosition.qty,
            existingPosition.avgEntry,
            qty,
            price,
            fee  // Include fee in cost basis
          );
          
          set((state) => ({
            spotAccount: state.spotAccount
              ? {
                  ...state.spotAccount,
                  cash: newCash,
                  balance: newCash,
                  availableToTrade: newCash,
                  updatedAt: now,
                }
              : null,
            stockPositions: state.stockPositions.map(p =>
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
            ),
          }));
        } else {
          // Create new position
          // Average entry includes fee: (qty * price + fee) / qty
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
            unrealizedPnL: -fee, // Start with the fee as initial loss
            unrealizedPnLPercent: (-fee / (qty * price)) * 100,
            openedAt: now,
            updatedAt: now,
          };
          
          set((state) => ({
            spotAccount: state.spotAccount
              ? {
                  ...state.spotAccount,
                  cash: newCash,
                  balance: newCash,
                  availableToTrade: newCash,
                  updatedAt: now,
                }
              : null,
            stockPositions: [...state.stockPositions, newPosition],
          }));
        }
        
        // Add ledger entry
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
        
        // 🔥 CRITICAL: Sync the new balance to Supabase (deduct cost)
        syncBalanceToSupabase(
          account.userId,
          newCash,
          -cost,
          `Stock Buy: ${qty} ${symbol}`
        );
        
        return { success: true };
      },
      
      executeStockSell: (positionId, qty, price, fee) => {
        const state = get();
        const account = state.spotAccount;
        const position = state.stockPositions.find(p => p.id === positionId);
        
        if (!account) return { success: false, error: 'Account not initialized' };
        if (!position) return { success: false, error: 'Position not found' };
        if (qty > position.qty) return { success: false, error: 'Quantity exceeds position' };
        
        // Stock P&L formula from doc: realized = (sell_price - avg) * q_sell - fee
        const grossPnL = (price - position.avgEntry) * qty;
        const realizedPnL = grossPnL - fee;  // Net P&L after fee
        const proceeds = qty * price - fee;
        const newCash = account.cash + proceeds;
        const now = new Date();
        
        if (qty === position.qty) {
          // Close entire position
          set((state) => ({
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
            stockPositions: state.stockPositions.filter(p => p.id !== positionId),
          }));
        } else {
          // Partial close
          set((state) => ({
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
            stockPositions: state.stockPositions.map(p =>
              p.id === positionId
                ? {
                    ...p,
                    qty: p.qty - qty,
                    marketValue: (p.qty - qty) * p.currentPrice,
                    unrealizedPnL: (p.currentPrice - p.avgEntry) * (p.qty - qty),
                    updatedAt: now,
                  }
                : p
            ),
          }));
        }
        
        // Add ledger entry
        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_close',
          amount: proceeds,
          balanceBefore: account.cash,
          balanceAfter: newCash,
          referenceId: positionId,
          referenceType: 'stock_sell',
          description: `Sell ${qty} ${position.symbol} @ $${price.toFixed(2)} | PnL: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`,
        });
        
        // 🔥 CRITICAL: Sync the new balance to Supabase
        syncBalanceToSupabase(
          account.userId,
          newCash,
          realizedPnL,
          `Stock Sell: ${qty} ${position.symbol}`
        );
        
        return { success: true, realizedPnL };
      },
      
      updateStockPositionPrice: (symbol, price) => {
        set((state) => ({
          stockPositions: state.stockPositions.map(p =>
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
          ),
        }));
      },
      
      // MARGIN/FX TRADING
      openMarginPosition: (symbol, name, type, side, qty, price, leverage, fee, stopLoss, takeProfit) => {
        const state = get();
        const account = state.marginAccount;
        
        if (!account) return { success: false, error: 'Account not initialized' };
        
        // Margin calculation: margin = notional / leverage
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
        
        // Calculate liquidation price
        const equity = calculateMarginEquity(newBalance, 0, 0, 0);
        newPosition.liquidationPrice = calculateLiquidationPrice(newPosition, equity, 0.5);
        
        set((state) => {
          const newMarginUsed = state.marginAccount!.marginUsed + requiredMargin;
          // Equity = balance + unrealizedPnL (existing positions)
          const currentUnrealizedPnL = state.marginPositions.reduce(
            (sum, p) => sum + (p.unrealizedPnL || 0), 0
          );
          const newEquity = newBalance + currentUnrealizedPnL;
          // Free margin = equity - used margin
          const newFreeMargin = newEquity - newMarginUsed;
          // Margin level = (equity / used margin) * 100
          const newMarginLevel = newMarginUsed > 0 ? (newEquity / newMarginUsed) * 100 : undefined;
          
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
            marginPositions: [...state.marginPositions, newPosition],
          };
        });
        
        // Add ledger entry
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
        
        // Sync fee deduction to Supabase (small but keeps balance accurate)
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
        const position = state.marginPositions.find(p => p.id === positionId);
        
        if (!account) return { success: false, error: 'Account not initialized' };
        if (!position) return { success: false, error: 'Position not found' };
        
        // Calculate P&L using the formula from the doc:
        // Long: pnl = (price - open) * units
        // Short: pnl = (open - price) * units
        const realizedPnL = calculateMarginPnL(position, price);
        const newBalance = account.balance + realizedPnL - fee;
        const now = new Date();
        
        // Update local state first
        set((state) => ({
          marginAccount: state.marginAccount
            ? {
                ...state.marginAccount,
                balance: newBalance,
                cash: newBalance, // Keep cash in sync
                marginUsed: state.marginAccount.marginUsed - position.requiredMargin,
                freeMargin: newBalance - (state.marginAccount.marginUsed - position.requiredMargin),
                equity: newBalance, // Update equity
                realizedPnL: state.marginAccount.realizedPnL + realizedPnL,
                unrealizedPnL: state.marginAccount.unrealizedPnL - position.unrealizedPnL,
                updatedAt: now,
              }
            : null,
          marginPositions: state.marginPositions.filter(p => p.id !== positionId),
        }));
        
        // Add ledger entry
        get().addLedgerEntry({
          accountId: account.id,
          type: 'trade_close',
          amount: realizedPnL - fee,
          balanceBefore: account.balance,
          balanceAfter: newBalance,
          referenceId: positionId,
          referenceType: 'margin_close',
          description: `Close ${position.side.toUpperCase()} ${position.qty} ${position.symbol} @ ${price} | PnL: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`,
        });
        
        // 🔥 CRITICAL: Sync the new balance to Supabase
        // This ensures profits/losses affect the user's actual deposited balance
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
        const position = state.marginPositions.find(p => p.id === positionId);
        
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
        
        set((state) => ({
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
          marginPositions: state.marginPositions.map(p =>
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
          ),
        }));
        
        // 🔥 Sync partial close P&L to Supabase
        syncBalanceToSupabase(
          account.userId,
          newBalance,
          realizedPnL - fee,
          `FX Partial Close: ${position.symbol} (${qty} units)`
        );
        
        return { success: true, realizedPnL };
      },
      
      updateMarginPositionPrice: (symbol, price) => {
        set((state) => {
          const updatedPositions = state.marginPositions.map(p => {
            if (p.symbol !== symbol) return p;
            
            const unrealizedPnL = calculateMarginPnL(p, price);
            
            return {
              ...p,
              currentPrice: price,
              unrealizedPnL,
              unrealizedPnLPercent: (unrealizedPnL / p.requiredMargin) * 100,
              updatedAt: new Date(),
            };
          });
          
          // Recalculate account unrealized PnL
          const totalUnrealizedPnL = updatedPositions.reduce(
            (sum, p) => sum + p.unrealizedPnL,
            0
          );
          
          return {
            marginPositions: updatedPositions,
            marginAccount: state.marginAccount
              ? {
                  ...state.marginAccount,
                  unrealizedPnL: totalUnrealizedPnL,
                  equity: state.marginAccount.balance + totalUnrealizedPnL,
                  marginLevel: state.marginAccount.marginUsed > 0
                    ? ((state.marginAccount.balance + totalUnrealizedPnL) / state.marginAccount.marginUsed) * 100
                    : undefined,
                }
              : null,
          };
        });
      },
      
      checkLiquidation: () => {
        const state = get();
        const account = state.marginAccount;
        if (!account || state.marginPositions.length === 0) return [];
        
        // Calculate total account metrics
        const totalUnrealizedPnL = state.marginPositions.reduce(
          (sum, p) => sum + (p.unrealizedPnL || 0), 0
        );
        const totalUsedMargin = state.marginPositions.reduce(
          (sum, p) => sum + (p.requiredMargin || 0), 0
        );
        const totalMaintenanceMargin = state.marginPositions.reduce(
          (sum, p) => sum + (p.maintenanceMargin || p.requiredMargin * 0.5), 0
        );
        
        // Account equity = balance + unrealized P&L
        const accountEquity = account.balance + totalUnrealizedPnL;
        
        // Margin Level % = (Equity / Used Margin) * 100
        const marginLevelPercent = totalUsedMargin > 0 
          ? (accountEquity / totalUsedMargin) * 100 
          : Infinity;
        
        const positionsToLiquidate: string[] = [];
        
        // Stop-out level: typically 50% margin level
        // When equity falls below maintenance margin, liquidate worst positions first
        if (accountEquity <= totalMaintenanceMargin || marginLevelPercent < 50) {
          // Sort positions by P&L (worst first) for liquidation order
          const sortedPositions = [...state.marginPositions].sort(
            (a, b) => (a.unrealizedPnL || 0) - (b.unrealizedPnL || 0)
          );
          
          let remainingEquity = accountEquity;
          let remainingMargin = totalUsedMargin;
          
          for (const position of sortedPositions) {
            // Check if we still need to liquidate
            if (remainingMargin > 0 && (remainingEquity / remainingMargin) * 100 < 100) {
              positionsToLiquidate.push(position.id);
              remainingMargin -= position.requiredMargin;
              remainingEquity -= position.unrealizedPnL; // Remove this position's P&L impact
            }
          }
        }
        
        return positionsToLiquidate;
      },
      
      // ==========================================
      // PENDING ORDERS (Limit/Stop)
      // ==========================================
      
      placeLimitOrder: (params) => {
        const state = get();
        const { symbol, name, type, side, orderType, qty, limitPrice, stopPrice, leverage, stopLoss, takeProfit } = params;
        
        // Determine which account to use
        const isStock = type === 'stock';
        const account = isStock ? state.spotAccount : state.marginAccount;
        
        if (!account) return { success: false, error: 'Account not initialized' };
        
        // Calculate required funds/margin
        let requiredAmount: number;
        if (isStock) {
          // For stocks: full purchase price
          requiredAmount = qty * limitPrice;
          if (requiredAmount > (account.cash || 0)) {
            return { success: false, error: 'Insufficient funds for limit order' };
          }
        } else {
          // For margin: margin required
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
        const order = state.openOrders.find(o => o.id === orderId);
        
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
          openOrders: state.openOrders.filter(o => o.id !== orderId),
          orderHistory: [cancelledOrder, ...state.orderHistory],
        }));
        
        return { success: true };
      },
      
      checkPendingOrders: (currentPrices) => {
        const state = get();
        const ordersToFill: Order[] = [];
        
        state.openOrders.forEach(order => {
          if (order.status !== 'pending' && order.status !== 'open') return;
          
          const priceData = currentPrices[order.symbol];
          if (!priceData) return;
          
          const { bid, ask } = priceData;
          let shouldFill = false;
          let fillPrice = 0;
          
          switch (order.type) {
            case 'limit':
              // Buy limit: fills when ask drops to or below limit price
              // Sell limit: fills when bid rises to or above limit price
              if (order.side === 'buy' && ask <= (order.price || 0)) {
                shouldFill = true;
                fillPrice = order.price || ask;
              } else if (order.side === 'sell' && bid >= (order.price || 0)) {
                shouldFill = true;
                fillPrice = order.price || bid;
              }
              break;
              
            case 'stop':
              // Buy stop: fills when ask rises to or above stop price
              // Sell stop: fills when bid drops to or below stop price
              if (order.side === 'buy' && ask >= (order.stopPrice || 0)) {
                shouldFill = true;
                fillPrice = ask;
              } else if (order.side === 'sell' && bid <= (order.stopPrice || 0)) {
                shouldFill = true;
                fillPrice = bid;
              }
              break;
              
            case 'stop_limit':
              // Stop-limit: stop triggers first, then becomes limit order
              if (order.side === 'buy' && ask >= (order.stopPrice || 0) && ask <= (order.price || 0)) {
                shouldFill = true;
                fillPrice = order.price || ask;
              } else if (order.side === 'sell' && bid <= (order.stopPrice || 0) && bid >= (order.price || 0)) {
                shouldFill = true;
                fillPrice = order.price || bid;
              }
              break;
          }
          
          if (shouldFill) {
            ordersToFill.push({ ...order, avgFillPrice: fillPrice });
          }
        });
        
        // Execute filled orders
        ordersToFill.forEach(order => {
          const fillPrice = order.avgFillPrice || order.price || 0;
          const fee = fillPrice * order.qty * 0.0001; // 0.01% fee
          
          // Remove from open orders
          set((state) => ({
            openOrders: state.openOrders.filter(o => o.id !== order.id),
          }));
          
          // Execute the trade (this will add to order history via the trading functions)
          // For simplicity, we call the market execution functions
          // In a real implementation, you'd want to pass the order metadata
          console.log(`[Trading] Limit order filled: ${order.side} ${order.qty} ${order.symbol} @ ${fillPrice}`);
          
          // Mark order as filled and add to history
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
      
      // ==========================================
      // SWAP/OVERNIGHT FEES
      // ==========================================
      
      applySwapFees: (swapRates) => {
        const state = get();
        const account = state.marginAccount;
        if (!account || state.marginPositions.length === 0) return;
        
        let totalSwapCharged = 0;
        const now = new Date();
        
        // Apply swap to each position
        const updatedPositions = state.marginPositions.map(position => {
          const rates = swapRates[position.symbol];
          if (!rates) return position;
          
          // Swap is typically per lot per day
          // Standard lot = 100,000 units
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
        
        // Deduct swap from account balance
        if (totalSwapCharged !== 0) {
          const newBalance = account.balance - totalSwapCharged;
          const totalUnrealizedPnL = updatedPositions.reduce(
            (sum, p) => sum + (p.unrealizedPnL || 0), 0
          );
          
          set({
            marginPositions: updatedPositions,
            marginAccount: {
              ...account,
              balance: newBalance,
              cash: newBalance,
              equity: newBalance + totalUnrealizedPnL,
              freeMargin: newBalance + totalUnrealizedPnL - account.marginUsed,
              updatedAt: now,
            },
          });
          
          // Add ledger entry for swap
          get().addLedgerEntry({
            accountId: account.id,
            type: 'funding',
            amount: -totalSwapCharged,
            balanceBefore: account.balance,
            balanceAfter: newBalance,
            description: `Overnight swap fees: ${totalSwapCharged >= 0 ? '-' : '+'}$${Math.abs(totalSwapCharged).toFixed(2)}`,
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
        }));
      },
      
      calculateSpotEquity: () => {
        const state = get();
        const account = state.spotAccount;
        if (!account) return 0;
        
        const marketValue = state.stockPositions.reduce(
          (sum, p) => sum + p.marketValue,
          0
        );
        
        return account.cash + marketValue;
      },
      
      calculateMarginEquity: () => {
        const state = get();
        const account = state.marginAccount;
        if (!account) return 0;
        
        return calculateMarginEquity(
          account.balance,
          account.unrealizedPnL,
          0,
          0
        );
      },
      
      calculateTotalUnrealizedPnL: () => {
        const state = get();
        
        const stockPnL = state.stockPositions.reduce(
          (sum, p) => sum + p.unrealizedPnL,
          0
        );
        
        const marginPnL = state.marginPositions.reduce(
          (sum, p) => sum + p.unrealizedPnL,
          0
        );
        
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
        ledger: state.ledger.slice(0, 100), // Keep last 100 entries
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
          investments: state.investments.map(inv =>
            inv.id === id
              ? { ...inv, currentValue: newValue, totalEarned: inv.totalEarned + earned }
              : inv
          ),
          totalEarned: state.totalEarned + earned,
        }));
      },
      
      completeInvestment: (id) => {
        set((state) => ({
          investments: state.investments.map(inv =>
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
          participations: state.participations.map(p =>
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
          participations: state.participations.map(p =>
            p.id === participationId
              ? { ...p, status: 'claimed', claimedAt: new Date() }
              : p
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
          a => a.currency === currency && a.network === network && a.isActive
        );
      },
      
      updateAddress: (id, newAddress, adminId) => {
        set((state) => ({
          addresses: state.addresses.map(a =>
            a.id === id
              ? { ...a, address: newAddress, updatedBy: adminId, updatedAt: new Date() }
              : a
          ),
        }));
      },
      
      addAddress: (address) => {
        const newAddress: DepositAddress = {
          ...address,
          id: `${address.currency.toLowerCase()}_${address.network.toLowerCase()}_${Date.now()}`,
          updatedAt: new Date(),
        };
        
        set((state) => ({
          addresses: [...state.addresses, newAddress],
        }));
      },
      
      toggleActive: (id) => {
        set((state) => ({
          addresses: state.addresses.map(a =>
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
