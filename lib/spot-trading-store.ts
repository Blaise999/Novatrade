import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  SpotPosition,
  SpotAccount,
  SpotTrade,
  ShieldSummary,
  calculateMarketValue,
  calculateUnrealizedPnL,
  calculateNewAvgPrice,
  calculateRealizedPnL,
  getDisplayValues,
  calculateShieldedPriceChange,
} from './spot-trading-types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { 
  syncCryptoTrade, 
  notifyBalanceUpdate 
} from '@/lib/services/balance-sync';

// ==========================================
// SUPABASE BALANCE SYNC HELPER
// ==========================================

/**
 * Updates the user's balance in Supabase when crypto trades execute
 */
async function syncCryptoBalanceToSupabase(
  userId: string, 
  newBalance: number,
  pnlChange: number,
  description: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) {
    console.log('[CryptoTrading] Supabase not configured, skipping sync');
    return false;
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({ 
        balance_available: Math.max(0, newBalance),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('[CryptoTrading] Failed to sync balance:', error);
      return false;
    }

    console.log(`[CryptoTrading] Balance synced: ${pnlChange >= 0 ? '+' : ''}${pnlChange.toFixed(2)} | New: $${newBalance.toFixed(2)} | ${description}`);
    
    // Notify all listeners that balance has changed
    notifyBalanceUpdate({
      available: newBalance,
      bonus: 0,
      totalDeposited: 0,
      timestamp: new Date(),
    });
    
    return true;
  } catch (err) {
    console.error('[CryptoTrading] Sync error:', err);
    return false;
  }
}

// ==========================================
// SUPABASE PORTFOLIO PERSISTENCE
// Syncs positions/trades to DB so they survive cross-device logins
// ==========================================

async function savePortfolioToSupabase(userId: string, state: {
  account: SpotAccount | null;
  positions: SpotPosition[];
  tradeHistory: SpotTrade[];
}): Promise<void> {
  if (!isSupabaseConfigured() || !userId) return;
  try {
    const payload = {
      account: state.account,
      positions: state.positions,
      tradeHistory: (state.tradeHistory || []).slice(0, 200),
    };
    await supabase
      .from('user_trading_data')
      .upsert({
        user_id: userId,
        spot_crypto_state: payload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
  } catch (err) {
    console.warn('[CryptoTrading] Portfolio save failed (table may not exist yet):', err);
  }
}

async function loadPortfolioFromSupabase(userId: string): Promise<{
  account: SpotAccount | null;
  positions: SpotPosition[];
  tradeHistory: SpotTrade[];
} | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_trading_data')
      .select('spot_crypto_state')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data?.spot_crypto_state) return null;
    const s = data.spot_crypto_state as any;
    // Rehydrate dates
    const positions = (s.positions || []).map((p: any) => ({
      ...p,
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      shieldActivatedAt: p.shieldActivatedAt ? new Date(p.shieldActivatedAt) : null,
    }));
    const tradeHistory = (s.tradeHistory || []).map((t: any) => ({
      ...t,
      executedAt: t.executedAt ? new Date(t.executedAt) : new Date(),
    }));
    const account = s.account ? {
      ...s.account,
      createdAt: s.account.createdAt ? new Date(s.account.createdAt) : new Date(),
      updatedAt: s.account.updatedAt ? new Date(s.account.updatedAt) : new Date(),
    } : null;
    return { account, positions, tradeHistory };
  } catch (err) {
    console.warn('[CryptoTrading] Portfolio load failed:', err);
    return null;
  }
}

// ==========================================
// SPOT TRADING STORE
// Implements Spot Asset Model with Shield Mode
// ==========================================

interface SpotTradingState {
  // Account
  account: SpotAccount | null;
  
  // Positions (crypto holdings)
  positions: SpotPosition[];
  
  // Trade history
  tradeHistory: SpotTrade[];
  
  // Real-time prices (from WebSocket)
  prices: Record<string, number>;

  // Loading state for Supabase hydration
  _hydrated: boolean;
  
  // ==========================================
  // ACCOUNT ACTIONS
  // ==========================================
  initializeAccount: (userId: string, initialCash?: number) => void;
  loadFromSupabase: (userId: string, fallbackCash?: number) => Promise<void>;
  syncCashFromUser: (cash: number) => void;
  
  // ==========================================
  // TRADING ACTIONS (Spot Model)
  // ==========================================
  executeBuy: (
    symbol: string,
    name: string,
    quantity: number,
    price: number,
    fee?: number,
    icon?: string
  ) => { success: boolean; error?: string };
  
  executeSell: (
    positionId: string,
    quantity: number,
    price: number,
    fee?: number
  ) => { success: boolean; realizedPnL?: number; error?: string };
  
  // ==========================================
  // PRICE UPDATE (WebSocket Handler)
  // ==========================================
  updatePrice: (symbol: string, price: number) => void;
  updatePrices: (prices: Record<string, number>) => void;
  
  // ==========================================
  // SHIELD MODE ACTIONS
  // ==========================================
  activateShield: (positionId: string) => { success: boolean; error?: string };
  deactivateShield: (positionId: string) => { success: boolean; error?: string };
  toggleShield: (positionId: string) => { success: boolean; error?: string };
  enableAllShields: () => void;
  disableAllShields: () => void;
  toggleGlobalShield: () => void;
  isGlobalShieldActive: () => boolean;
  getShieldSummary: () => ShieldSummary;
  
  // ==========================================
  // COMPUTED VALUES
  // ==========================================
  getTotalPortfolioValue: () => number;
  getDisplayPortfolioValue: () => number;
  getTotalEquity: () => number;
  getTotalUnrealizedPnL: () => number;
  getPositionBySymbol: (symbol: string) => SpotPosition | undefined;
}

export const useSpotTradingStore = create<SpotTradingState>()(
  persist(
    (set, get) => ({
      account: null,
      positions: [],
      tradeHistory: [],
      prices: {},
      _hydrated: false,
      
      // ==========================================
      // ACCOUNT INITIALIZATION
      // ==========================================
      initializeAccount: (userId, initialCash = 0) => {
        const existing = get();
        // Don't reinitialize if already loaded for this user
        if (existing.account && existing.account.userId === userId && existing.positions.length > 0) {
          // Just sync cash
          if (initialCash > 0) {
            set(state => ({
              account: state.account ? { ...state.account, cashBalance: initialCash, updatedAt: new Date() } : null
            }));
          }
          return;
        }
        const now = new Date();
        const account: SpotAccount = {
          id: `spot_${userId}`,
          userId,
          cashBalance: initialCash,
          portfolioValue: 0,
          displayPortfolioValue: 0,
          totalEquity: initialCash,
          totalUnrealizedPnL: 0,
          totalRealizedPnL: 0,
          currency: 'USD',
          createdAt: now,
          updatedAt: now,
        };
        set({ account });
      },

      // ==========================================
      // LOAD FROM SUPABASE (cross-device sync)
      // ==========================================
      loadFromSupabase: async (userId, fallbackCash = 0) => {
        const remote = await loadPortfolioFromSupabase(userId);
        if (remote && remote.positions && remote.positions.length > 0) {
          // Remote has data — use it (positions survive across devices)
          const account = remote.account || {
            id: `spot_${userId}`,
            userId,
            cashBalance: fallbackCash,
            portfolioValue: 0,
            displayPortfolioValue: 0,
            totalEquity: fallbackCash,
            totalUnrealizedPnL: 0,
            totalRealizedPnL: 0,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          // Sync cash from user profile (always trust Supabase user balance)
          account.cashBalance = fallbackCash;
          const portfolioValue = remote.positions.reduce((sum, p) => sum + p.marketValue, 0);
          const displayPortfolioValue = remote.positions.reduce((sum, p) => sum + p.displayValue, 0);
          account.portfolioValue = portfolioValue;
          account.displayPortfolioValue = displayPortfolioValue;
          account.totalEquity = fallbackCash + displayPortfolioValue;
          set({
            account,
            positions: remote.positions,
            tradeHistory: remote.tradeHistory || [],
            _hydrated: true,
          });
          return;
        }
        // No remote data — check if localStorage already has data for this user
        const local = get();
        if (local.account && local.account.userId === userId && local.positions.length > 0) {
          // localStorage has data for this user, keep it and sync to Supabase
          set({ _hydrated: true });
          savePortfolioToSupabase(userId, {
            account: local.account,
            positions: local.positions,
            tradeHistory: local.tradeHistory,
          });
          return;
        }
        // No data anywhere, initialize fresh
        get().initializeAccount(userId, fallbackCash);
        set({ _hydrated: true });
      },
      
      syncCashFromUser: (cash) => {
        const state = get();
        if (!state.account) return;
        
        // Recalculate portfolio values
        const portfolioValue = state.positions.reduce(
          (sum, p) => sum + p.marketValue,
          0
        );
        const displayPortfolioValue = state.positions.reduce(
          (sum, p) => sum + p.displayValue,
          0
        );
        
        set({
          account: {
            ...state.account,
            cashBalance: cash,
            portfolioValue,
            displayPortfolioValue,
            totalEquity: cash + displayPortfolioValue,
            updatedAt: new Date(),
          },
        });
      },
      
      // ==========================================
      // BUY EXECUTION (Spot Model)
      // Balance = Quantity × Price
      // ==========================================
      executeBuy: (symbol, name, quantity, price, fee = 0, icon) => {
        const state = get();
        if (!state.account) {
          return { success: false, error: 'Account not initialized' };
        }
        
        const totalCost = quantity * price + fee;
        
        if (totalCost > state.account.cashBalance) {
          return { success: false, error: 'Insufficient balance' };
        }
        
        const now = new Date();
        const existingPosition = state.positions.find(p => p.symbol === symbol);
        
        // Create trade record
        const trade: SpotTrade = {
          id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          positionId: existingPosition?.id,
          userId: state.account.userId,
          symbol,
          name,
          side: 'buy',
          quantity,
          price,
          totalValue: quantity * price,
          fee,
          netValue: totalCost,
          executedAt: now,
        };
        
        if (existingPosition) {
          // Add to existing position
          const newQty = existingPosition.quantity + quantity;
          const newAvgPrice = calculateNewAvgPrice(
            existingPosition.quantity,
            existingPosition.avgBuyPrice,
            quantity,
            price
          );
          const newCostBasis = existingPosition.totalCostBasis + totalCost;
          const marketValue = calculateMarketValue(newQty, existingPosition.currentPrice);
          const { pnl, pnlPercent } = calculateUnrealizedPnL(marketValue, newCostBasis);
          
          // Get display values (respects shield)
          const displayValues = existingPosition.shieldEnabled && existingPosition.shieldSnapPrice
            ? {
                value: newQty * existingPosition.shieldSnapPrice,
                pnl: (newQty * existingPosition.shieldSnapPrice) - newCostBasis,
                pnlPercent: ((newQty * existingPosition.shieldSnapPrice) - newCostBasis) / newCostBasis * 100,
              }
            : { value: marketValue, pnl, pnlPercent };
          
          set((state) => ({
            account: state.account
              ? {
                  ...state.account,
                  cashBalance: state.account.cashBalance - totalCost,
                  updatedAt: now,
                }
              : null,
            positions: state.positions.map((p) =>
              p.symbol === symbol
                ? {
                    ...p,
                    quantity: newQty,
                    avgBuyPrice: newAvgPrice,
                    totalCostBasis: newCostBasis,
                    marketValue,
                    unrealizedPnL: pnl,
                    unrealizedPnLPercent: pnlPercent,
                    displayValue: displayValues.value,
                    displayPnL: displayValues.pnl,
                    displayPnLPercent: displayValues.pnlPercent,
                    // Update shield snap value if shield is active
                    shieldSnapValue: p.shieldEnabled && p.shieldSnapPrice
                      ? newQty * p.shieldSnapPrice
                      : null,
                    updatedAt: now,
                  }
                : p
            ),
            tradeHistory: [trade, ...state.tradeHistory],
          }));
        } else {
          // Create new position
          const marketValue = calculateMarketValue(quantity, price);
          const newPosition: SpotPosition = {
            id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            userId: state.account.userId,
            symbol,
            name,
            icon,
            quantity,
            avgBuyPrice: price,
            totalCostBasis: totalCost,
            currentPrice: price,
            marketValue,
            unrealizedPnL: -fee, // Initial P&L is just the fee
            unrealizedPnLPercent: fee > 0 ? (-fee / totalCost) * 100 : 0,
            // Shield starts disabled
            shieldEnabled: false,
            shieldSnapPrice: null,
            shieldSnapValue: null,
            shieldActivatedAt: null,
            // Display values (same as market when no shield)
            displayValue: marketValue,
            displayPnL: -fee,
            displayPnLPercent: fee > 0 ? (-fee / totalCost) * 100 : 0,
            createdAt: now,
            updatedAt: now,
          };
          
          trade.positionId = newPosition.id;
          
          set((state) => ({
            account: state.account
              ? {
                  ...state.account,
                  cashBalance: state.account.cashBalance - totalCost,
                  updatedAt: now,
                }
              : null,
            positions: [...state.positions, newPosition],
            tradeHistory: [trade, ...state.tradeHistory],
          }));
        }
        
        // Recalculate account totals
        const newState = get();
        const portfolioValue = newState.positions.reduce((sum, p) => sum + p.marketValue, 0);
        const displayPortfolioValue = newState.positions.reduce((sum, p) => sum + p.displayValue, 0);
        const totalUnrealizedPnL = newState.positions.reduce((sum, p) => sum + p.displayPnL, 0);
        
        set((state) => ({
          account: state.account
            ? {
                ...state.account,
                portfolioValue,
                displayPortfolioValue,
                totalEquity: state.account.cashBalance + displayPortfolioValue,
                totalUnrealizedPnL,
              }
            : null,
        }));
        
        // 🔥 Sync the new balance to Supabase (deduct cost)
        const finalState = get();
        if (finalState.account) {
          syncCryptoBalanceToSupabase(
            finalState.account.userId,
            finalState.account.cashBalance,
            -totalCost,
            `Crypto Buy: ${quantity} ${symbol}`
          );
          // 🔥 CRITICAL: Persist positions to Supabase for cross-device sync
          savePortfolioToSupabase(finalState.account.userId, {
            account: finalState.account,
            positions: finalState.positions,
            tradeHistory: finalState.tradeHistory,
          });
        }
        
        return { success: true };
      },
      
      // ==========================================
      // SELL EXECUTION (Spot Model)
      // ==========================================
      executeSell: (positionId, quantity, price, fee = 0) => {
        const state = get();
        if (!state.account) {
          return { success: false, error: 'Account not initialized' };
        }
        
        const position = state.positions.find((p) => p.id === positionId);
        if (!position) {
          return { success: false, error: 'Position not found' };
        }
        
        if (quantity > position.quantity) {
          return { success: false, error: 'Quantity exceeds position size' };
        }
        
        const now = new Date();
        const proceeds = quantity * price - fee;
        const realizedPnL = calculateRealizedPnL(quantity, price, position.avgBuyPrice) - fee;
        
        // Create trade record
        const trade: SpotTrade = {
          id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          positionId,
          userId: state.account.userId,
          symbol: position.symbol,
          name: position.name,
          side: 'sell',
          quantity,
          price,
          totalValue: quantity * price,
          fee,
          netValue: proceeds,
          realizedPnL,
          executedAt: now,
        };
        
        if (quantity === position.quantity) {
          // Close entire position
          set((state) => ({
            account: state.account
              ? {
                  ...state.account,
                  cashBalance: state.account.cashBalance + proceeds,
                  totalRealizedPnL: state.account.totalRealizedPnL + realizedPnL,
                  updatedAt: now,
                }
              : null,
            positions: state.positions.filter((p) => p.id !== positionId),
            tradeHistory: [trade, ...state.tradeHistory],
          }));
        } else {
          // Partial close
          const remainingQty = position.quantity - quantity;
          const remainingCostBasis = position.avgBuyPrice * remainingQty;
          const marketValue = calculateMarketValue(remainingQty, position.currentPrice);
          const { pnl, pnlPercent } = calculateUnrealizedPnL(marketValue, remainingCostBasis);
          
          // Get display values
          const displayValues = position.shieldEnabled && position.shieldSnapPrice
            ? {
                value: remainingQty * position.shieldSnapPrice,
                pnl: (remainingQty * position.shieldSnapPrice) - remainingCostBasis,
                pnlPercent: ((remainingQty * position.shieldSnapPrice) - remainingCostBasis) / remainingCostBasis * 100,
              }
            : { value: marketValue, pnl, pnlPercent };
          
          set((state) => ({
            account: state.account
              ? {
                  ...state.account,
                  cashBalance: state.account.cashBalance + proceeds,
                  totalRealizedPnL: state.account.totalRealizedPnL + realizedPnL,
                  updatedAt: now,
                }
              : null,
            positions: state.positions.map((p) =>
              p.id === positionId
                ? {
                    ...p,
                    quantity: remainingQty,
                    totalCostBasis: remainingCostBasis,
                    marketValue,
                    unrealizedPnL: pnl,
                    unrealizedPnLPercent: pnlPercent,
                    displayValue: displayValues.value,
                    displayPnL: displayValues.pnl,
                    displayPnLPercent: displayValues.pnlPercent,
                    shieldSnapValue: p.shieldEnabled && p.shieldSnapPrice
                      ? remainingQty * p.shieldSnapPrice
                      : null,
                    updatedAt: now,
                  }
                : p
            ),
            tradeHistory: [trade, ...state.tradeHistory],
          }));
        }
        
        // Recalculate account totals
        const newState = get();
        const portfolioValue = newState.positions.reduce((sum, p) => sum + p.marketValue, 0);
        const displayPortfolioValue = newState.positions.reduce((sum, p) => sum + p.displayValue, 0);
        const totalUnrealizedPnL = newState.positions.reduce((sum, p) => sum + p.displayPnL, 0);
        
        set((state) => ({
          account: state.account
            ? {
                ...state.account,
                portfolioValue,
                displayPortfolioValue,
                totalEquity: state.account.cashBalance + displayPortfolioValue,
                totalUnrealizedPnL,
              }
            : null,
        }));
        
        // 🔥 CRITICAL: Sync the new balance to Supabase
        const finalState = get();
        if (finalState.account) {
          syncCryptoBalanceToSupabase(
            finalState.account.userId,
            finalState.account.cashBalance,
            realizedPnL,
            `Crypto Sell: ${quantity} ${position.symbol}`
          );
          // 🔥 CRITICAL: Persist positions to Supabase for cross-device sync
          savePortfolioToSupabase(finalState.account.userId, {
            account: finalState.account,
            positions: finalState.positions,
            tradeHistory: finalState.tradeHistory,
          });
        }
        
        return { success: true, realizedPnL };
      },
      
      // ==========================================
      // PRICE UPDATES (WebSocket Handler)
      // This is the core of the Spot Model:
      // When price changes, positions update automatically
      // ==========================================
      updatePrice: (symbol, price) => {
        set((state) => {
          const newPrices = { ...state.prices, [symbol]: price };
          
          // Update positions with new price
          const updatedPositions = state.positions.map((p) => {
            if (p.symbol !== symbol) return p;
            
            const marketValue = calculateMarketValue(p.quantity, price);
            const { pnl, pnlPercent } = calculateUnrealizedPnL(
              marketValue,
              p.totalCostBasis
            );
            
            // Display values respect shield mode
            const displayValues = p.shieldEnabled && p.shieldSnapPrice !== null
              ? {
                  value: p.shieldSnapValue ?? p.quantity * p.shieldSnapPrice,
                  pnl: (p.shieldSnapValue ?? p.quantity * p.shieldSnapPrice) - p.totalCostBasis,
                  pnlPercent: ((p.shieldSnapValue ?? p.quantity * p.shieldSnapPrice) - p.totalCostBasis) / p.totalCostBasis * 100,
                }
              : { value: marketValue, pnl, pnlPercent };
            
            return {
              ...p,
              currentPrice: price,
              marketValue,
              unrealizedPnL: pnl,
              unrealizedPnLPercent: pnlPercent,
              displayValue: displayValues.value,
              displayPnL: displayValues.pnl,
              displayPnLPercent: displayValues.pnlPercent,
              updatedAt: new Date(),
            };
          });
          
          // Recalculate account totals
          const portfolioValue = updatedPositions.reduce((sum, p) => sum + p.marketValue, 0);
          const displayPortfolioValue = updatedPositions.reduce((sum, p) => sum + p.displayValue, 0);
          const totalUnrealizedPnL = updatedPositions.reduce((sum, p) => sum + p.displayPnL, 0);
          
          return {
            prices: newPrices,
            positions: updatedPositions,
            account: state.account
              ? {
                  ...state.account,
                  portfolioValue,
                  displayPortfolioValue,
                  totalEquity: state.account.cashBalance + displayPortfolioValue,
                  totalUnrealizedPnL,
                  updatedAt: new Date(),
                }
              : null,
          };
        });
      },
      
      updatePrices: (prices) => {
        Object.entries(prices).forEach(([symbol, price]) => {
          get().updatePrice(symbol, price);
        });
      },
      
      // ==========================================
      // SHIELD MODE ACTIONS
      // ==========================================
      
      /**
       * Activate Shield: Locks the current price for a position
       * The position value stays frozen at this "snap price" until deactivated
       */
      activateShield: (positionId) => {
        const state = get();
        const position = state.positions.find((p) => p.id === positionId);
        
        if (!position) {
          return { success: false, error: 'Position not found' };
        }
        
        if (position.shieldEnabled) {
          return { success: false, error: 'Shield already active' };
        }
        
        const now = new Date();
        const snapPrice = position.currentPrice;
        const snapValue = position.quantity * snapPrice;
        
        // Log shield activation to database for audit trail
        if (isSupabaseConfigured() && state.account?.userId) {
          supabase.from('shield_events').insert({
            user_id: state.account.userId,
            position_id: positionId,
            symbol: position.symbol,
            event_type: 'activated',
            snap_price: snapPrice,
            snap_value: snapValue,
            market_price: position.currentPrice,
            market_value: position.marketValue,
            quantity: position.quantity,
            cost_basis: position.totalCostBasis,
          }).then(({ error }) => {
            if (error) console.error('[Shield] Failed to log activation:', error);
            else console.log(`[Shield] Activation logged: ${position.symbol} @ $${snapPrice.toFixed(2)}`);
          });
        }
        
        set((state) => ({
          positions: state.positions.map((p) =>
            p.id === positionId
              ? {
                  ...p,
                  shieldEnabled: true,
                  shieldSnapPrice: snapPrice,
                  shieldSnapValue: snapValue,
                  shieldActivatedAt: now,
                  // Update display values to use snapped values
                  displayValue: snapValue,
                  displayPnL: snapValue - p.totalCostBasis,
                  displayPnLPercent: ((snapValue - p.totalCostBasis) / p.totalCostBasis) * 100,
                  updatedAt: now,
                }
              : p
          ),
        }));
        
        // Recalculate account totals
        const newState = get();
        const displayPortfolioValue = newState.positions.reduce((sum, p) => sum + p.displayValue, 0);
        const totalUnrealizedPnL = newState.positions.reduce((sum, p) => sum + p.displayPnL, 0);
        
        set((state) => ({
          account: state.account
            ? {
                ...state.account,
                displayPortfolioValue,
                totalEquity: state.account.cashBalance + displayPortfolioValue,
                totalUnrealizedPnL,
                updatedAt: now,
              }
            : null,
        }));
        
        // Save shield state to Supabase
        const postActivate = get();
        if (postActivate.account) {
          savePortfolioToSupabase(postActivate.account.userId, {
            account: postActivate.account,
            positions: postActivate.positions,
            tradeHistory: postActivate.tradeHistory,
          });
        }

        return { success: true };
      },
      
      /**
       * Deactivate Shield: Unlocks the position to track live price again
       */
      deactivateShield: (positionId) => {
        const state = get();
        const position = state.positions.find((p) => p.id === positionId);
        
        if (!position) {
          return { success: false, error: 'Position not found' };
        }
        
        if (!position.shieldEnabled) {
          return { success: false, error: 'Shield not active' };
        }
        
        const now = new Date();
        const marketValue = position.marketValue;
        const { pnl, pnlPercent } = calculateUnrealizedPnL(
          marketValue,
          position.totalCostBasis
        );
        
        // Calculate shield impact (difference between shielded and market value)
        const shieldImpact = (position.shieldSnapValue ?? 0) - marketValue;
        
        // Log shield deactivation to database for audit trail
        if (isSupabaseConfigured() && state.account?.userId) {
          supabase.from('shield_events').insert({
            user_id: state.account.userId,
            position_id: positionId,
            symbol: position.symbol,
            event_type: 'deactivated',
            snap_price: position.shieldSnapPrice,
            snap_value: position.shieldSnapValue,
            market_price: position.currentPrice,
            market_value: marketValue,
            quantity: position.quantity,
            cost_basis: position.totalCostBasis,
            shield_impact: shieldImpact,
            duration_seconds: position.shieldActivatedAt 
              ? Math.floor((now.getTime() - position.shieldActivatedAt.getTime()) / 1000) 
              : null,
          }).then(({ error }) => {
            if (error) console.error('[Shield] Failed to log deactivation:', error);
            else console.log(`[Shield] Deactivation logged: ${position.symbol} | Impact: ${shieldImpact >= 0 ? '+' : ''}$${shieldImpact.toFixed(2)}`);
          });
        }
        
        set((state) => ({
          positions: state.positions.map((p) =>
            p.id === positionId
              ? {
                  ...p,
                  shieldEnabled: false,
                  shieldSnapPrice: null,
                  shieldSnapValue: null,
                  shieldActivatedAt: null,
                  // Update display values to use live values
                  displayValue: marketValue,
                  displayPnL: pnl,
                  displayPnLPercent: pnlPercent,
                  updatedAt: now,
                }
              : p
          ),
        }));
        
        // Recalculate account totals
        const newStateD = get();
        const displayPortfolioValueD = newStateD.positions.reduce((sum, p) => sum + p.displayValue, 0);
        const totalUnrealizedPnLD = newStateD.positions.reduce((sum, p) => sum + p.displayPnL, 0);
        
        set((state) => ({
          account: state.account
            ? {
                ...state.account,
                displayPortfolioValue: displayPortfolioValueD,
                totalEquity: state.account.cashBalance + displayPortfolioValueD,
                totalUnrealizedPnL: totalUnrealizedPnLD,
                updatedAt: now,
              }
            : null,
        }));

        // Save shield state to Supabase
        const postDeactivate = get();
        if (postDeactivate.account) {
          savePortfolioToSupabase(postDeactivate.account.userId, {
            account: postDeactivate.account,
            positions: postDeactivate.positions,
            tradeHistory: postDeactivate.tradeHistory,
          });
        }
        
        return { success: true };
      },
      
      /**
       * Toggle Shield: Convenience method to flip shield state
       */
      toggleShield: (positionId) => {
        const state = get();
        const position = state.positions.find((p) => p.id === positionId);
        
        if (!position) {
          return { success: false, error: 'Position not found' };
        }
        
        return position.shieldEnabled
          ? get().deactivateShield(positionId)
          : get().activateShield(positionId);
      },

      /**
       * Enable shields on ALL positions (global on)
       */
      enableAllShields: () => {
        const state = get();
        state.positions.forEach((p) => {
          if (!p.shieldEnabled) {
            get().activateShield(p.id);
          }
        });
      },

      /**
       * Disable shields on ALL positions (global off)
       */
      disableAllShields: () => {
        const state = get();
        state.positions.forEach((p) => {
          if (p.shieldEnabled) {
            get().deactivateShield(p.id);
          }
        });
      },

      /**
       * Toggle all shields on/off
       */
      toggleGlobalShield: () => {
        const anyActive = get().positions.some((p) => p.shieldEnabled);
        if (anyActive) {
          get().disableAllShields();
        } else {
          get().enableAllShields();
        }
      },

      /**
       * Check if any shield is active
       */
      isGlobalShieldActive: () => {
        return get().positions.some((p) => p.shieldEnabled);
      },
      
      /**
       * Get summary of all active shields
       */
      getShieldSummary: () => {
        const state = get();
        const shieldedPositions = state.positions.filter((p) => p.shieldEnabled);
        
        return {
          totalShielded: shieldedPositions.reduce((sum, p) => sum + (p.shieldSnapValue ?? 0), 0),
          activeShields: shieldedPositions.length,
          positions: shieldedPositions.map((p) => {
            const change = calculateShieldedPriceChange(p);
            return {
              symbol: p.symbol,
              quantity: p.quantity,
              snapPrice: p.shieldSnapPrice ?? 0,
              snapValue: p.shieldSnapValue ?? 0,
              currentPrice: p.currentPrice,
              priceChangeWhileShielded: change?.priceChange ?? 0,
              priceChangePercent: change?.priceChangePercent ?? 0,
            };
          }),
        };
      },
      
      // ==========================================
      // COMPUTED VALUES
      // ==========================================
      getTotalPortfolioValue: () => {
        return get().positions.reduce((sum, p) => sum + p.marketValue, 0);
      },
      
      getDisplayPortfolioValue: () => {
        return get().positions.reduce((sum, p) => sum + p.displayValue, 0);
      },
      
      getTotalEquity: () => {
        const state = get();
        if (!state.account) return 0;
        return state.account.cashBalance + get().getDisplayPortfolioValue();
      },
      
      getTotalUnrealizedPnL: () => {
        return get().positions.reduce((sum, p) => sum + p.displayPnL, 0);
      },
      
      getPositionBySymbol: (symbol) => {
        return get().positions.find((p) => p.symbol === symbol);
      },
    }),
    {
      name: 'novatrade-spot-trading',
      partialize: (state) => ({
        account: state.account,
        positions: state.positions,
        tradeHistory: state.tradeHistory.slice(0, 100), // Keep last 100 trades
        prices: state.prices,
      }),
    }
  )
);

// ==========================================
// CONVENIENCE HOOKS
// ==========================================

export function useSpotPosition(symbol: string) {
  return useSpotTradingStore((state) => state.positions.find((p) => p.symbol === symbol));
}

export function useShieldedPositions() {
  return useSpotTradingStore((state) => state.positions.filter((p) => p.shieldEnabled));
}

export function useSpotEquity() {
  const account = useSpotTradingStore((state) => state.account);
  const displayPortfolioValue = useSpotTradingStore((state) => 
    state.positions.reduce((sum, p) => sum + p.displayValue, 0)
  );
  
  return {
    cashBalance: account?.cashBalance ?? 0,
    portfolioValue: displayPortfolioValue,
    totalEquity: (account?.cashBalance ?? 0) + displayPortfolioValue,
  };
}
