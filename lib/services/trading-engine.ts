/**
 * Trading Engine
 * 
 * Handles all trading operations with proper accounting:
 * - Balance management
 * - Position tracking
 * - P&L calculation (unrealized and realized)
 * - Trade history
 * - Ledger entries
 * 
 * This is the single source of truth for all trading operations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// ==========================================
// TYPES
// ==========================================

export interface Position {
  id: string;
  symbol: string;
  name: string;
  type: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  marginUsed: number;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  openedAt: Date;
  source: 'live' | 'edu';
  marketType: 'crypto' | 'forex' | 'stocks';
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  name: string;
  type: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  leverage: number;
  marginUsed: number;
  realizedPnL: number;
  realizedPnLPercent: number;
  fees: number;
  openedAt: Date;
  closedAt: Date;
  closeReason: 'manual' | 'stop_loss' | 'take_profit' | 'liquidation';
  source: 'live' | 'edu';
  marketType: 'crypto' | 'forex' | 'stocks';
}

export interface LedgerEntry {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'trade_open' | 'trade_close' | 'trade_pnl' | 'fee' | 'admin_credit' | 'admin_debit';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  referenceType?: string;
  source?: 'live' | 'edu';
  createdAt: Date;
  adminId?: string;
  adminNote?: string;
}

export interface TradingAccount {
  userId: string;
  balance: number;           // Realized funds
  equity: number;            // Balance + Unrealized P&L
  unrealizedPnL: number;     // From open positions
  marginUsed: number;        // Locked in positions
  freeMargin: number;        // Available for new trades
  totalDeposited: number;
  totalWithdrawn: number;
  totalPnL: number;          // All time P&L
}

// ==========================================
// TRADING ENGINE STORE
// ==========================================

interface TradingEngineState {
  // Account state
  account: TradingAccount | null;
  
  // Positions
  positions: Position[];
  
  // Trade history
  tradeHistory: ClosedTrade[];
  
  // Ledger
  ledger: LedgerEntry[];
  
  // Loading state
  isLoading: boolean;
  
  // Initialization
  initializeAccount: (userId: string) => void;
  loadFromDatabase: (userId: string) => Promise<void>;
  
  // Balance management (Admin only)
  creditBalance: (amount: number, adminId: string, reason: string) => Promise<boolean>;
  debitBalance: (amount: number, adminId: string, reason: string) => Promise<boolean>;
  
  // Trading operations
  openPosition: (params: {
    symbol: string;
    name: string;
    type: 'long' | 'short';
    entryPrice: number;
    quantity: number;
    leverage?: number;
    stopLoss?: number;
    takeProfit?: number;
    source: 'live' | 'edu';
    marketType: 'crypto' | 'forex' | 'stocks';
  }) => { success: boolean; position?: Position; error?: string };
  
  closePosition: (
    positionId: string,
    exitPrice: number,
    reason?: 'manual' | 'stop_loss' | 'take_profit'
  ) => { success: boolean; trade?: ClosedTrade; error?: string };
  
  updatePositionPrice: (symbol: string, price: number) => void;
  
  updatePositionSLTP: (
    positionId: string,
    stopLoss?: number,
    takeProfit?: number
  ) => boolean;
  
  // Risk management
  checkStopLossTakeProfit: (symbol: string, currentPrice: number) => void;
  checkLiquidation: () => string[];
  
  // Computed values
  calculateEquity: () => number;
  calculateMarginLevel: () => number | null;
  getTotalUnrealizedPnL: () => number;
  
  // Sync to database
  syncToDatabase: () => Promise<void>;
}

export const useTradingEngine = create<TradingEngineState>()(
  persist(
    (set, get) => ({
      account: null,
      positions: [],
      tradeHistory: [],
      ledger: [],
      isLoading: false,
      
      // ==========================================
      // INITIALIZATION
      // ==========================================
      
      initializeAccount: (userId: string) => {
        const existingAccount = get().account;
        
        if (existingAccount && existingAccount.userId === userId) {
          return; // Already initialized
        }
        
        // Start with ZERO balance - no fake money
        const newAccount: TradingAccount = {
          userId,
          balance: 0,
          equity: 0,
          unrealizedPnL: 0,
          marginUsed: 0,
          freeMargin: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          totalPnL: 0,
        };
        
        set({ account: newAccount });
      },
      
      loadFromDatabase: async (userId: string) => {
        if (!isSupabaseConfigured()) {
          get().initializeAccount(userId);
          return;
        }
        
        set({ isLoading: true });
        
        try {
          // Load user balance
          const { data: userData } = await supabase
            .from('users')
            .select('balance_available, total_deposited, total_withdrawn')
            .eq('id', userId)
            .single();
          
          // Load open positions (trades)
          const { data: openTrades } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'open');
          
          // Load trade history
          const { data: closedTrades } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'closed')
            .order('closed_at', { ascending: false })
            .limit(100);
          
          // Load ledger
          const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);
          
          // Convert to our types
          const positions: Position[] = (openTrades || []).map(t => ({
            id: t.id,
            symbol: t.pair,
            name: t.pair,
            type: t.side as 'long' | 'short',
            entryPrice: parseFloat(t.entry_price),
            currentPrice: parseFloat(t.current_price) || parseFloat(t.entry_price),
            quantity: parseFloat(t.quantity) || 0,
            leverage: t.leverage || 1,
            marginUsed: parseFloat(t.margin_used) || 0,
            stopLoss: t.stop_loss ? parseFloat(t.stop_loss) : undefined,
            takeProfit: t.take_profit ? parseFloat(t.take_profit) : undefined,
            unrealizedPnL: parseFloat(t.pnl) || 0,
            unrealizedPnLPercent: parseFloat(t.pnl_percentage) || 0,
            openedAt: new Date(t.opened_at),
            source: t.source || 'live',
            marketType: t.market_type || 'crypto',
          }));
          
          const tradeHistory: ClosedTrade[] = (closedTrades || []).map(t => ({
            id: t.id,
            symbol: t.pair,
            name: t.pair,
            type: t.side as 'long' | 'short',
            entryPrice: parseFloat(t.entry_price),
            exitPrice: parseFloat(t.exit_price) || 0,
            quantity: parseFloat(t.quantity) || 0,
            leverage: t.leverage || 1,
            marginUsed: parseFloat(t.margin_used) || 0,
            realizedPnL: parseFloat(t.pnl) || 0,
            realizedPnLPercent: parseFloat(t.pnl_percentage) || 0,
            fees: parseFloat(t.fees) || 0,
            openedAt: new Date(t.opened_at),
            closedAt: new Date(t.closed_at),
            closeReason: t.close_reason || 'manual',
            source: t.source || 'live',
            marketType: t.market_type || 'crypto',
          }));
          
          const ledger: LedgerEntry[] = (transactions || []).map(t => ({
            id: t.id,
            userId: t.user_id,
            type: t.type,
            amount: parseFloat(t.amount),
            balanceBefore: parseFloat(t.balance_before),
            balanceAfter: parseFloat(t.balance_after),
            description: t.description,
            referenceId: t.reference_id,
            referenceType: t.reference_type,
            source: t.source,
            createdAt: new Date(t.created_at),
            adminId: t.created_by,
            adminNote: t.metadata?.adminNote,
          }));
          
          // Calculate totals
          const marginUsed = positions.reduce((sum, p) => sum + p.marginUsed, 0);
          const unrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
          const balance = parseFloat(userData?.balance_available || '0');
          
          const account: TradingAccount = {
            userId,
            balance,
            equity: balance + unrealizedPnL,
            unrealizedPnL,
            marginUsed,
            freeMargin: balance - marginUsed,
            totalDeposited: parseFloat(userData?.total_deposited || '0'),
            totalWithdrawn: parseFloat(userData?.total_withdrawn || '0'),
            totalPnL: tradeHistory.reduce((sum, t) => sum + t.realizedPnL, 0),
          };
          
          set({
            account,
            positions,
            tradeHistory,
            ledger,
            isLoading: false,
          });
        } catch (error) {
          console.error('Error loading from database:', error);
          get().initializeAccount(userId);
          set({ isLoading: false });
        }
      },
      
      // ==========================================
      // BALANCE MANAGEMENT
      // ==========================================
      
      creditBalance: async (amount: number, adminId: string, reason: string) => {
        const state = get();
        if (!state.account) return false;
        
        const balanceBefore = state.account.balance;
        const balanceAfter = balanceBefore + amount;
        
        const entry: LedgerEntry = {
          id: `ledger_${Date.now()}`,
          userId: state.account.userId,
          type: 'admin_credit',
          amount,
          balanceBefore,
          balanceAfter,
          description: `Admin credit: ${reason}`,
          createdAt: new Date(),
          adminId,
          adminNote: reason,
        };
        
        set(state => ({
          account: state.account ? {
            ...state.account,
            balance: balanceAfter,
            equity: balanceAfter + state.account.unrealizedPnL,
            freeMargin: balanceAfter - state.account.marginUsed,
          } : null,
          ledger: [entry, ...state.ledger],
        }));
        
        await get().syncToDatabase();
        return true;
      },
      
      debitBalance: async (amount: number, adminId: string, reason: string) => {
        const state = get();
        if (!state.account) return false;
        if (state.account.balance < amount) return false;
        
        const balanceBefore = state.account.balance;
        const balanceAfter = balanceBefore - amount;
        
        const entry: LedgerEntry = {
          id: `ledger_${Date.now()}`,
          userId: state.account.userId,
          type: 'admin_debit',
          amount: -amount,
          balanceBefore,
          balanceAfter,
          description: `Admin debit: ${reason}`,
          createdAt: new Date(),
          adminId,
          adminNote: reason,
        };
        
        set(state => ({
          account: state.account ? {
            ...state.account,
            balance: balanceAfter,
            equity: balanceAfter + state.account.unrealizedPnL,
            freeMargin: balanceAfter - state.account.marginUsed,
          } : null,
          ledger: [entry, ...state.ledger],
        }));
        
        await get().syncToDatabase();
        return true;
      },
      
      // ==========================================
      // TRADING OPERATIONS
      // ==========================================
      
      openPosition: ({ symbol, name, type, entryPrice, quantity, leverage = 1, stopLoss, takeProfit, source, marketType }) => {
        const state = get();
        if (!state.account) return { success: false, error: 'Account not initialized' };
        
        // Calculate margin required
        const notionalValue = quantity * entryPrice;
        const marginRequired = notionalValue / leverage;
        
        // Check available margin
        if (marginRequired > state.account.freeMargin) {
          return { success: false, error: `Insufficient margin. Required: $${marginRequired.toFixed(2)}, Available: $${state.account.freeMargin.toFixed(2)}` };
        }
        
        // Create position
        const position: Position = {
          id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          symbol,
          name,
          type,
          entryPrice,
          currentPrice: entryPrice,
          quantity,
          leverage,
          marginUsed: marginRequired,
          stopLoss,
          takeProfit,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          openedAt: new Date(),
          source,
          marketType,
        };
        
        // Create ledger entry
        const entry: LedgerEntry = {
          id: `ledger_${Date.now()}`,
          userId: state.account.userId,
          type: 'trade_open',
          amount: -marginRequired,
          balanceBefore: state.account.balance,
          balanceAfter: state.account.balance,
          description: `Opened ${type.toUpperCase()} ${symbol} @ ${entryPrice.toFixed(2)}`,
          referenceId: position.id,
          referenceType: 'position',
          source,
          createdAt: new Date(),
        };
        
        set(state => ({
          account: state.account ? {
            ...state.account,
            marginUsed: state.account.marginUsed + marginRequired,
            freeMargin: state.account.freeMargin - marginRequired,
          } : null,
          positions: [...state.positions, position],
          ledger: [entry, ...state.ledger],
        }));
        
        get().syncToDatabase();
        
        return { success: true, position };
      },
      
      closePosition: (positionId, exitPrice, reason = 'manual') => {
        const state = get();
        if (!state.account) return { success: false, error: 'Account not initialized' };
        
        const position = state.positions.find(p => p.id === positionId);
        if (!position) return { success: false, error: 'Position not found' };
        
        // Calculate P&L
        const priceDiff = position.type === 'long'
          ? exitPrice - position.entryPrice
          : position.entryPrice - exitPrice;
        
        const rawPnL = priceDiff * position.quantity;
        const leveragedPnL = rawPnL * position.leverage;
        const fees = position.marginUsed * 0.001; // 0.1% fee
        const realizedPnL = leveragedPnL - fees;
        const realizedPnLPercent = (realizedPnL / position.marginUsed) * 100;
        
        // Create closed trade record
        const closedTrade: ClosedTrade = {
          id: position.id,
          symbol: position.symbol,
          name: position.name,
          type: position.type,
          entryPrice: position.entryPrice,
          exitPrice,
          quantity: position.quantity,
          leverage: position.leverage,
          marginUsed: position.marginUsed,
          realizedPnL,
          realizedPnLPercent,
          fees,
          openedAt: position.openedAt,
          closedAt: new Date(),
          closeReason: reason,
          source: position.source,
          marketType: position.marketType,
        };
        
        // Calculate new balance
        const newBalance = state.account.balance + position.marginUsed + realizedPnL;
        
        // Create ledger entry
        const entry: LedgerEntry = {
          id: `ledger_${Date.now()}`,
          userId: state.account.userId,
          type: 'trade_close',
          amount: position.marginUsed + realizedPnL,
          balanceBefore: state.account.balance,
          balanceAfter: newBalance,
          description: `Closed ${position.type.toUpperCase()} ${position.symbol} @ ${exitPrice.toFixed(2)} | P&L: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`,
          referenceId: position.id,
          referenceType: 'trade',
          source: position.source,
          createdAt: new Date(),
        };
        
        // Update state
        const newMarginUsed = state.account.marginUsed - position.marginUsed;
        const remainingUnrealizedPnL = state.positions
          .filter(p => p.id !== positionId)
          .reduce((sum, p) => sum + p.unrealizedPnL, 0);
        
        set(state => ({
          account: state.account ? {
            ...state.account,
            balance: newBalance,
            equity: newBalance + remainingUnrealizedPnL,
            marginUsed: newMarginUsed,
            freeMargin: newBalance - newMarginUsed,
            unrealizedPnL: remainingUnrealizedPnL,
            totalPnL: state.account.totalPnL + realizedPnL,
          } : null,
          positions: state.positions.filter(p => p.id !== positionId),
          tradeHistory: [closedTrade, ...state.tradeHistory],
          ledger: [entry, ...state.ledger],
        }));
        
        get().syncToDatabase();
        
        return { success: true, trade: closedTrade };
      },
      
      updatePositionPrice: (symbol, price) => {
        set(state => {
          let totalUnrealizedPnL = 0;
          
          const updatedPositions = state.positions.map(p => {
            if (p.symbol !== symbol) {
              totalUnrealizedPnL += p.unrealizedPnL;
              return p;
            }
            
            // Calculate new P&L
            const priceDiff = p.type === 'long'
              ? price - p.entryPrice
              : p.entryPrice - price;
            
            const rawPnL = priceDiff * p.quantity;
            const unrealizedPnL = rawPnL * p.leverage;
            const unrealizedPnLPercent = (unrealizedPnL / p.marginUsed) * 100;
            
            totalUnrealizedPnL += unrealizedPnL;
            
            return {
              ...p,
              currentPrice: price,
              unrealizedPnL,
              unrealizedPnLPercent,
            };
          });
          
          return {
            positions: updatedPositions,
            account: state.account ? {
              ...state.account,
              unrealizedPnL: totalUnrealizedPnL,
              equity: state.account.balance + totalUnrealizedPnL,
            } : null,
          };
        });
      },
      
      updatePositionSLTP: (positionId, stopLoss, takeProfit) => {
        const position = get().positions.find(p => p.id === positionId);
        if (!position) return false;
        
        set(state => ({
          positions: state.positions.map(p =>
            p.id === positionId
              ? { ...p, stopLoss, takeProfit }
              : p
          ),
        }));
        
        return true;
      },
      
      // ==========================================
      // RISK MANAGEMENT
      // ==========================================
      
      checkStopLossTakeProfit: (symbol, currentPrice) => {
        const state = get();
        
        state.positions
          .filter(p => p.symbol === symbol)
          .forEach(position => {
            // Check stop loss
            if (position.stopLoss) {
              const hitSL = position.type === 'long'
                ? currentPrice <= position.stopLoss
                : currentPrice >= position.stopLoss;
              
              if (hitSL) {
                get().closePosition(position.id, currentPrice, 'stop_loss');
                return;
              }
            }
            
            // Check take profit
            if (position.takeProfit) {
              const hitTP = position.type === 'long'
                ? currentPrice >= position.takeProfit
                : currentPrice <= position.takeProfit;
              
              if (hitTP) {
                get().closePosition(position.id, currentPrice, 'take_profit');
              }
            }
          });
      },
      
      checkLiquidation: () => {
        const state = get();
        if (!state.account) return [];
        
        const liquidationThreshold = 0.5; // 50% margin level
        const positionsToLiquidate: string[] = [];
        
        state.positions.forEach(position => {
          // Calculate position's effective equity
          const effectiveEquity = position.marginUsed + position.unrealizedPnL;
          const marginLevel = effectiveEquity / position.marginUsed;
          
          if (marginLevel < liquidationThreshold) {
            positionsToLiquidate.push(position.id);
          }
        });
        
        return positionsToLiquidate;
      },
      
      // ==========================================
      // COMPUTED VALUES
      // ==========================================
      
      calculateEquity: () => {
        const state = get();
        if (!state.account) return 0;
        return state.account.balance + state.account.unrealizedPnL;
      },
      
      calculateMarginLevel: () => {
        const state = get();
        if (!state.account || state.account.marginUsed === 0) return null;
        return (state.account.equity / state.account.marginUsed) * 100;
      },
      
      getTotalUnrealizedPnL: () => {
        return get().positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
      },
      
      // ==========================================
      // DATABASE SYNC
      // ==========================================
      
      syncToDatabase: async () => {
        if (!isSupabaseConfigured()) return;
        
        const state = get();
        if (!state.account) return;
        
        try {
          // Update user balance
          await supabase
            .from('users')
            .update({
              balance_available: state.account.balance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', state.account.userId);
          
          // Sync positions to trades table
          for (const position of state.positions) {
            await supabase
              .from('trades')
              .upsert({
                id: position.id,
                user_id: state.account.userId,
                pair: position.symbol,
                market_type: position.marketType,
                type: position.type === 'long' ? 'buy' : 'sell',
                side: position.type,
                amount: position.marginUsed,
                quantity: position.quantity,
                entry_price: position.entryPrice,
                current_price: position.currentPrice,
                leverage: position.leverage,
                margin_used: position.marginUsed,
                stop_loss: position.stopLoss,
                take_profit: position.takeProfit,
                pnl: position.unrealizedPnL,
                pnl_percentage: position.unrealizedPnLPercent,
                status: 'open',
                source: position.source,
                opened_at: position.openedAt.toISOString(),
                updated_at: new Date().toISOString(),
              });
          }
          
          // Add new ledger entries
          const recentEntries = state.ledger.slice(0, 10);
          for (const entry of recentEntries) {
            const existing = await supabase
              .from('transactions')
              .select('id')
              .eq('id', entry.id)
              .single();
            
            if (!existing.data) {
              await supabase
                .from('transactions')
                .insert({
                  id: entry.id,
                  user_id: entry.userId,
                  type: entry.type,
                  amount: entry.amount,
                  balance_before: entry.balanceBefore,
                  balance_after: entry.balanceAfter,
                  description: entry.description,
                  reference_type: entry.referenceType,
                  reference_id: entry.referenceId,
                  source: entry.source,
                  created_by: entry.adminId,
                  metadata: entry.adminNote ? { adminNote: entry.adminNote } : null,
                  created_at: entry.createdAt.toISOString(),
                });
            }
          }
        } catch (error) {
          console.error('Error syncing to database:', error);
        }
      },
    }),
    {
      name: 'novatrade-trading-engine',
      partialize: (state) => ({
        account: state.account,
        positions: state.positions,
        tradeHistory: state.tradeHistory.slice(0, 100),
        ledger: state.ledger.slice(0, 100),
      }),
    }
  )
);

// ==========================================
// PRICE UPDATE HOOK
// ==========================================

export function usePositionPriceUpdates() {
  const updatePositionPrice = useTradingEngine(state => state.updatePositionPrice);
  const checkStopLossTakeProfit = useTradingEngine(state => state.checkStopLossTakeProfit);
  
  const updatePrice = (symbol: string, price: number) => {
    updatePositionPrice(symbol, price);
    checkStopLossTakeProfit(symbol, price);
  };
  
  return updatePrice;
}
