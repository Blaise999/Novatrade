/**
 * UNIFIED TRADING ENGINE
 * 
 * Implements the exact formulas from the FX/Stock trading specification:
 * 
 * FX (Margin Trading):
 * - Notional = units × price
 * - Long P/L = (price - open) × units
 * - Short P/L = (open - price) × units
 * - Margin Required = notional / leverage
 * - Equity = balance + Σ(floating_pnl)
 * - Free Margin = equity - used_margin
 * - Margin Level % = (equity / used_margin) × 100
 * 
 * Stocks (Spot Trading):
 * - Market Value = qty × price
 * - Cost Basis = qty × avg_price
 * - Unrealized P/L = (price - avg) × qty
 * - New Avg on Buy = (q_old × avg_old + q_buy × buy_price) / new_q
 * - Realized P/L on Sell = (sell_price - avg) × qty - fee
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// ==========================================
// TYPES
// ==========================================

export interface FXPosition {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  side: 'long' | 'short';
  units: number;           // Position size in base currency units
  openPrice: number;       // Entry price
  currentPrice: number;    // Mark-to-market price
  leverage: number;
  notional: number;        // units × openPrice
  margin: number;          // Required margin (notional / leverage)
  unrealizedPnL: number;   // Floating P/L
  unrealizedPnLPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  spreadCost: number;      // Cost of spread at entry
  swapAccumulated: number; // Overnight fees accumulated
  openedAt: Date;
  updatedAt: Date;
}

export interface StockPosition {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  qty: number;
  avgPrice: number;        // Weighted average cost basis
  currentPrice: number;
  marketValue: number;     // qty × currentPrice
  costBasis: number;       // qty × avgPrice
  unrealizedPnL: number;   // marketValue - costBasis
  unrealizedPnLPercent: number;
  openedAt: Date;
  updatedAt: Date;
}

export interface CryptoPosition {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  shieldEnabled?: boolean;
  shieldSnapPrice?: number;
  openedAt: Date;
  updatedAt: Date;
}

export interface AccountMetrics {
  balance: number;         // Cash balance (from Supabase)
  equity: number;          // balance + Σ(unrealized_pnl)
  usedMargin: number;      // Σ(margin for open FX positions)
  freeMargin: number;      // equity - usedMargin
  marginLevel?: number;    // (equity / usedMargin) × 100
  totalUnrealizedPnL: number;
  totalRealizedPnL: number;
  portfolioValue: number;  // Total value of stocks + crypto
}

// ==========================================
// FX TRADING FORMULAS
// ==========================================

/**
 * Calculate P/L for a margin position
 * Long: (currentPrice - openPrice) × units
 * Short: (openPrice - currentPrice) × units
 */
export function calculateFXPnL(
  side: 'long' | 'short',
  openPrice: number,
  currentPrice: number,
  units: number
): number {
  if (side === 'long') {
    return (currentPrice - openPrice) * units;
  } else {
    return (openPrice - currentPrice) * units;
  }
}

/**
 * Calculate required margin
 * margin = notional / leverage = (units × price) / leverage
 */
export function calculateMargin(
  units: number,
  price: number,
  leverage: number
): number {
  const notional = units * price;
  return notional / leverage;
}

/**
 * Calculate notional value
 * notional = units × price
 */
export function calculateNotional(units: number, price: number): number {
  return units * price;
}

/**
 * Calculate pip value for standard lot (100,000 units)
 * For most pairs: pip_value = lot_size × pip_size
 * Standard pip size = 0.0001 (0.01 for JPY pairs)
 */
export function calculatePipValue(
  lotSize: number,
  pipSize: number = 0.0001
): number {
  const units = lotSize * 100000; // Convert lots to units
  return units * pipSize;
}

/**
 * Calculate spread in pips
 */
export function calculateSpreadPips(
  ask: number,
  bid: number,
  pipSize: number = 0.0001
): number {
  return (ask - bid) / pipSize;
}

/**
 * Calculate margin level percentage
 * margin_level = (equity / used_margin) × 100
 */
export function calculateMarginLevel(
  equity: number,
  usedMargin: number
): number | undefined {
  if (usedMargin <= 0) return undefined;
  return (equity / usedMargin) * 100;
}

/**
 * Calculate liquidation price
 * The price at which equity = maintenance margin
 */
export function calculateLiquidationPrice(
  side: 'long' | 'short',
  openPrice: number,
  units: number,
  equity: number,
  maintenanceMarginRatio: number = 0.5,
  margin: number
): number {
  const maintenanceMargin = margin * maintenanceMarginRatio;
  const availableForLoss = equity - maintenanceMargin;
  
  if (side === 'long') {
    // Long liquidates when price drops
    return openPrice - (availableForLoss / units);
  } else {
    // Short liquidates when price rises
    return openPrice + (availableForLoss / units);
  }
}

// ==========================================
// STOCK TRADING FORMULAS
// ==========================================

/**
 * Calculate market value
 * value = qty × price
 */
export function calculateMarketValue(qty: number, price: number): number {
  return qty * price;
}

/**
 * Calculate cost basis
 * cost = qty × avgPrice
 */
export function calculateCostBasis(qty: number, avgPrice: number): number {
  return qty * avgPrice;
}

/**
 * Calculate unrealized P/L for stocks
 * upl = (price - avg) × qty
 */
export function calculateStockPnL(
  qty: number,
  avgPrice: number,
  currentPrice: number
): { pnl: number; pnlPercent: number } {
  const pnl = (currentPrice - avgPrice) * qty;
  const pnlPercent = avgPrice > 0 ? ((currentPrice / avgPrice) - 1) * 100 : 0;
  return { pnl, pnlPercent };
}

/**
 * Calculate new average price on buy
 * new_avg = (q_old × avg_old + q_buy × buy_price) / new_q
 */
export function calculateNewAvgPrice(
  qtyOld: number,
  avgOld: number,
  qtyBuy: number,
  buyPrice: number,
  fee: number = 0
): number {
  const newQty = qtyOld + qtyBuy;
  if (newQty === 0) return 0;
  return ((qtyOld * avgOld) + (qtyBuy * buyPrice) + fee) / newQty;
}

/**
 * Calculate realized P/L on sell (Average Cost Method)
 * realized = (sell_price - avg) × qty_sell - fee
 */
export function calculateRealizedPnL(
  avgPrice: number,
  sellPrice: number,
  qtySell: number,
  fee: number = 0
): number {
  return (sellPrice - avgPrice) * qtySell - fee;
}

// ==========================================
// ACCOUNT METRICS
// ==========================================

/**
 * Calculate complete account metrics
 */
export function calculateAccountMetrics(
  balance: number,
  fxPositions: FXPosition[],
  stockPositions: StockPosition[],
  cryptoPositions: CryptoPosition[]
): AccountMetrics {
  // FX metrics
  const fxUnrealizedPnL = fxPositions.reduce(
    (sum, p) => sum + p.unrealizedPnL,
    0
  );
  const usedMargin = fxPositions.reduce(
    (sum, p) => sum + p.margin,
    0
  );
  
  // Stock metrics
  const stockValue = stockPositions.reduce(
    (sum, p) => sum + p.marketValue,
    0
  );
  const stockUnrealizedPnL = stockPositions.reduce(
    (sum, p) => sum + p.unrealizedPnL,
    0
  );
  
  // Crypto metrics
  const cryptoValue = cryptoPositions.reduce(
    (sum, p) => sum + p.marketValue,
    0
  );
  const cryptoUnrealizedPnL = cryptoPositions.reduce(
    (sum, p) => sum + p.unrealizedPnL,
    0
  );
  
  // Total metrics
  const totalUnrealizedPnL = fxUnrealizedPnL + stockUnrealizedPnL + cryptoUnrealizedPnL;
  const equity = balance + fxUnrealizedPnL; // FX P/L affects equity directly
  const freeMargin = equity - usedMargin;
  const marginLevel = calculateMarginLevel(equity, usedMargin);
  const portfolioValue = stockValue + cryptoValue;
  
  return {
    balance,
    equity,
    usedMargin,
    freeMargin,
    marginLevel,
    totalUnrealizedPnL,
    totalRealizedPnL: 0, // This would come from trade history
    portfolioValue,
  };
}

// ==========================================
// SUPABASE BALANCE SYNC
// ==========================================

/**
 * Sync balance changes to Supabase
 * Called when:
 * - FX position is closed (realized P/L)
 * - Stock is sold (realized P/L + proceeds)
 * - Crypto is sold (realized P/L + proceeds)
 */
export async function syncBalanceToSupabase(
  userId: string,
  newBalance: number,
  changeAmount: number,
  description: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) {
    console.log('[TradingEngine] Supabase not configured, skipping sync');
    return false;
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({
        balance_available: Math.max(0, newBalance),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[TradingEngine] Balance sync failed:', error);
      return false;
    }

    console.log(
      `[TradingEngine] Balance synced: ${changeAmount >= 0 ? '+' : ''}$${changeAmount.toFixed(2)} | ` +
      `New Balance: $${newBalance.toFixed(2)} | ${description}`
    );
    return true;
  } catch (err) {
    console.error('[TradingEngine] Sync error:', err);
    return false;
  }
}

/**
 * Fetch current user balance from Supabase
 */
export async function fetchUserBalance(userId: string): Promise<number | null> {
  if (!isSupabaseConfigured() || !userId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('balance_available')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('[TradingEngine] Failed to fetch balance:', error);
      return null;
    }

    return Number(data.balance_available) || 0;
  } catch (err) {
    console.error('[TradingEngine] Fetch error:', err);
    return null;
  }
}

// ==========================================
// POSITION UPDATE HELPERS
// ==========================================

/**
 * Update FX position with new price
 */
export function updateFXPositionPrice(
  position: FXPosition,
  newPrice: number
): FXPosition {
  const unrealizedPnL = calculateFXPnL(
    position.side,
    position.openPrice,
    newPrice,
    position.units
  );
  
  const unrealizedPnLPercent = position.margin > 0
    ? (unrealizedPnL / position.margin) * 100
    : 0;
  
  return {
    ...position,
    currentPrice: newPrice,
    unrealizedPnL,
    unrealizedPnLPercent,
    updatedAt: new Date(),
  };
}

/**
 * Update stock position with new price
 */
export function updateStockPositionPrice(
  position: StockPosition,
  newPrice: number
): StockPosition {
  const marketValue = calculateMarketValue(position.qty, newPrice);
  const { pnl, pnlPercent } = calculateStockPnL(
    position.qty,
    position.avgPrice,
    newPrice
  );
  
  return {
    ...position,
    currentPrice: newPrice,
    marketValue,
    unrealizedPnL: pnl,
    unrealizedPnLPercent: pnlPercent,
    updatedAt: new Date(),
  };
}

/**
 * Update crypto position with new price
 */
export function updateCryptoPositionPrice(
  position: CryptoPosition,
  newPrice: number
): CryptoPosition {
  const marketValue = position.quantity * newPrice;
  const pnl = marketValue - position.costBasis;
  const pnlPercent = position.costBasis > 0
    ? (pnl / position.costBasis) * 100
    : 0;
  
  return {
    ...position,
    currentPrice: newPrice,
    marketValue,
    unrealizedPnL: pnl,
    unrealizedPnLPercent: pnlPercent,
    updatedAt: new Date(),
  };
}

// ==========================================
// RISK CHECKS
// ==========================================

/**
 * Check if margin level is below stop-out threshold
 */
export function isMarginCallTriggered(
  marginLevel: number | undefined,
  marginCallThreshold: number = 100
): boolean {
  if (marginLevel === undefined) return false;
  return marginLevel < marginCallThreshold;
}

/**
 * Check if margin level is below stop-out threshold
 */
export function isStopOutTriggered(
  marginLevel: number | undefined,
  stopOutThreshold: number = 50
): boolean {
  if (marginLevel === undefined) return false;
  return marginLevel < stopOutThreshold;
}

/**
 * Check if stop loss is triggered
 */
export function isStopLossTriggered(
  side: 'long' | 'short',
  currentPrice: number,
  stopLoss?: number
): boolean {
  if (!stopLoss) return false;
  
  if (side === 'long') {
    return currentPrice <= stopLoss;
  } else {
    return currentPrice >= stopLoss;
  }
}

/**
 * Check if take profit is triggered
 */
export function isTakeProfitTriggered(
  side: 'long' | 'short',
  currentPrice: number,
  takeProfit?: number
): boolean {
  if (!takeProfit) return false;
  
  if (side === 'long') {
    return currentPrice >= takeProfit;
  } else {
    return currentPrice <= takeProfit;
  }
}

// ==========================================
// PRICE HELPERS
// ==========================================

/**
 * Get pip size for a currency pair
 */
export function getPipSize(symbol: string): number {
  // JPY pairs have pip size of 0.01
  if (symbol.includes('JPY')) {
    return 0.01;
  }
  return 0.0001;
}

/**
 * Format price based on instrument
 */
export function formatPrice(price: number, symbol?: string): string {
  if (symbol?.includes('JPY')) {
    return price.toFixed(2);
  }
  if (price >= 100) {
    return price.toFixed(2);
  }
  if (price >= 1) {
    return price.toFixed(4);
  }
  return price.toFixed(5);
}

/**
 * Convert lots to units
 * 1 standard lot = 100,000 units
 */
export function lotsToUnits(lots: number): number {
  return lots * 100000;
}

/**
 * Convert units to lots
 */
export function unitsToLots(units: number): number {
  return units / 100000;
}
