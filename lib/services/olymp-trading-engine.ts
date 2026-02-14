/**
 * OLYMP-STYLE TRADING ENGINE
 * 
 * Simplified trading model using:
 * - Investment (I): Actual cash the user puts up
 * - Multiplier (M): The leverage/amplifier (e.g., x100)
 * - Direction (D): +1 for Buy/Up, -1 for Sell/Down
 * 
 * CORE FORMULAS:
 * - Volume (V) = Investment × Multiplier (virtual trade size)
 * - Relative Change = (P_current - P_entry) / P_entry
 * - Floating P/L = D × I × M × Relative_Change
 * - Liquidation Price = P_entry × (1 - D / M)
 * 
 * SPREAD (Broker Revenue):
 * - Ask Price = Market_Mid + (Spread / 2)  [for buys]
 * - Bid Price = Market_Mid - (Spread / 2)  [for sells]
 * 
 * CRITICAL RULES:
 * 1. User cannot lose more than their Investment
 * 2. Auto-close (liquidate) when Floating_PL ≤ -Investment
 * 3. Server-side execution ONLY - client is just a display
 * 4. Atomic balance updates with transactions
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface OlympTrade {
  id: string;
  oderId: string;
  userId: string;
  
  // Core trade data
  asset: string;
  assetType: 'crypto' | 'forex' | 'stock' | 'commodity';
  direction: 1 | -1;  // 1 = Buy/Up, -1 = Sell/Down
  
  // Financial data
  investment: number;       // I - actual cash risked
  multiplier: number;       // M - leverage (x10, x100, etc.)
  volume: number;           // V = I × M (virtual trade size)
  entryPrice: number;       // P_entry at moment of click
  
  // Risk management
  liquidationPrice: number; // Pre-calculated "death price"
  stopLoss?: number;
  takeProfit?: number;
  
  // Spread (broker revenue)
  spreadCost: number;       // Cost in $ at entry
  spreadPips?: number;      // Spread in pips
  
  // Current state
  currentPrice: number;
  floatingPnL: number;      // Real-time P/L
  floatingPnLPercent: number;
  
  // Status
  status: 'active' | 'closed' | 'liquidated' | 'stopped_out' | 'take_profit';
  closedAt?: string;
  exitPrice?: number;
  finalPnL?: number;
  
  // Timestamps
  openedAt: string;
  updatedAt: string;
}

export interface TradeOpenParams {
  userId: string;
  asset: string;
  assetType: 'crypto' | 'forex' | 'stock' | 'commodity';
  direction: 'buy' | 'sell' | 'up' | 'down';
  investment: number;
  multiplier: number;
  marketPrice: number;  // Current market mid price
  spreadPercent?: number; // Spread as percentage (e.g., 0.0001 = 1 pip for forex)
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradeCloseResult {
  success: boolean;
  error?: string;
  trade?: OlympTrade;
  finalPnL?: number;
  newBalance?: number;
}

export interface TradeUpdateResult {
  floatingPnL: number;
  floatingPnLPercent: number;
  shouldLiquidate: boolean;
  shouldStopOut: boolean;
  shouldTakeProfit: boolean;
}

// ==========================================
// SPREAD CONFIGURATION
// ==========================================

const DEFAULT_SPREADS: Record<string, number> = {
  // Forex major pairs (in decimal, e.g., 0.0001 = 1 pip)
  'EUR/USD': 0.00008,
  'GBP/USD': 0.00010,
  'USD/JPY': 0.008,
  'USD/CHF': 0.00012,
  'AUD/USD': 0.00010,
  'USD/CAD': 0.00012,
  'NZD/USD': 0.00012,
  
  // Forex cross pairs
  'EUR/GBP': 0.00015,
  'EUR/JPY': 0.012,
  'GBP/JPY': 0.018,
  
  // Crypto (percentage of price)
  'BTC/USD': 0.0003,
  'ETH/USD': 0.0004,
  'default': 0.0002,
};

// ==========================================
// CORE MATH FUNCTIONS
// ==========================================

/**
 * Calculate the direction multiplier from string input
 */
export function getDirection(input: 'buy' | 'sell' | 'up' | 'down'): 1 | -1 {
  return (input === 'buy' || input === 'up') ? 1 : -1;
}

/**
 * Calculate Volume (virtual trade size)
 * V = I × M
 */
export function calculateVolume(investment: number, multiplier: number): number {
  return investment * multiplier;
}

/**
 * Calculate Relative Change (as decimal)
 * RC = (P_current - P_entry) / P_entry
 */
export function calculateRelativeChange(entryPrice: number, currentPrice: number): number {
  if (entryPrice === 0) return 0;
  return (currentPrice - entryPrice) / entryPrice;
}

/**
 * Calculate Floating P/L
 * PL = D × I × M × RC
 * Where RC = (P_current - P_entry) / P_entry
 */
export function calculateFloatingPnL(
  direction: 1 | -1,
  investment: number,
  multiplier: number,
  entryPrice: number,
  currentPrice: number
): number {
  const relativeChange = calculateRelativeChange(entryPrice, currentPrice);
  return direction * investment * multiplier * relativeChange;
}

/**
 * Calculate P/L as percentage of investment
 */
export function calculatePnLPercent(
  direction: 1 | -1,
  multiplier: number,
  entryPrice: number,
  currentPrice: number
): number {
  const relativeChange = calculateRelativeChange(entryPrice, currentPrice);
  return direction * multiplier * relativeChange * 100;
}

/**
 * Calculate Liquidation Price (the "death price")
 * For BUY:  P_liq = P_entry × (1 - 1/M)
 * For SELL: P_liq = P_entry × (1 + 1/M)
 * 
 * This is the price at which Floating_PL = -Investment (100% loss)
 */
export function calculateLiquidationPrice(
  direction: 1 | -1,
  entryPrice: number,
  multiplier: number
): number {
  if (multiplier === 0) return 0;
  return entryPrice * (1 - (direction / multiplier));
}

/**
 * Check if position should be liquidated
 * Rule: If Floating_PL ≤ -Investment, the trade must die
 */
export function shouldLiquidate(floatingPnL: number, investment: number): boolean {
  return floatingPnL <= -investment;
}

/**
 * Check if stop loss should trigger
 */
export function shouldStopOut(
  direction: 1 | -1,
  currentPrice: number,
  stopLoss?: number
): boolean {
  if (!stopLoss) return false;
  if (direction === 1) {
    return currentPrice <= stopLoss;
  } else {
    return currentPrice >= stopLoss;
  }
}

/**
 * Check if take profit should trigger
 */
export function shouldTakeProfit(
  direction: 1 | -1,
  currentPrice: number,
  takeProfit?: number
): boolean {
  if (!takeProfit) return false;
  if (direction === 1) {
    return currentPrice >= takeProfit;
  } else {
    return currentPrice <= takeProfit;
  }
}

/**
 * Calculate Ask/Bid prices from mid price
 * Ask = Mid + (Spread / 2) — used for BUY entry
 * Bid = Mid - (Spread / 2) — used for SELL entry
 */
export function calculateSpreadPrices(
  midPrice: number,
  spreadPercent: number
): { ask: number; bid: number; spreadCost: number } {
  const halfSpread = midPrice * spreadPercent / 2;
  return {
    ask: midPrice + halfSpread,
    bid: midPrice - halfSpread,
    spreadCost: midPrice * spreadPercent,
  };
}

/**
 * Get effective entry price including spread
 * BUY: enters at Ask (higher price)
 * SELL: enters at Bid (lower price)
 */
export function getEntryPrice(
  direction: 1 | -1,
  midPrice: number,
  spreadPercent: number
): { entryPrice: number; spreadCost: number } {
  const { ask, bid, spreadCost } = calculateSpreadPrices(midPrice, spreadPercent);
  return {
    entryPrice: direction === 1 ? ask : bid,
    spreadCost: spreadCost * 0.5, // User pays half the spread
  };
}

/**
 * Get effective exit price including spread
 * BUY closes at Bid (lower price)
 * SELL closes at Ask (higher price)
 */
export function getExitPrice(
  direction: 1 | -1,
  midPrice: number,
  spreadPercent: number
): number {
  const { ask, bid } = calculateSpreadPrices(midPrice, spreadPercent);
  return direction === 1 ? bid : ask;
}

// ==========================================
// TRADE LIFECYCLE
// ==========================================

/**
 * Create a new trade object (called when user clicks BUY/SELL)
 * This is SERVER-SIDE - the app is just a TV screen!
 */
export function createTrade(params: TradeOpenParams): {
  trade: OlympTrade;
  requiredBalance: number;
  error?: string;
} {
  const {
    userId,
    asset,
    assetType,
    direction: dirInput,
    investment,
    multiplier,
    marketPrice,
    spreadPercent = DEFAULT_SPREADS[asset] || DEFAULT_SPREADS.default,
    stopLoss,
    takeProfit,
  } = params;

  // Validate inputs
  if (investment <= 0) {
    return { trade: null as any, requiredBalance: 0, error: 'Investment must be positive' };
  }
  if (multiplier < 1) {
    return { trade: null as any, requiredBalance: 0, error: 'Multiplier must be at least 1' };
  }
  if (marketPrice <= 0) {
    return { trade: null as any, requiredBalance: 0, error: 'Invalid market price' };
  }

  const direction = getDirection(dirInput);
  const { entryPrice, spreadCost } = getEntryPrice(direction, marketPrice, spreadPercent);
  const volume = calculateVolume(investment, multiplier);
  const liquidationPrice = calculateLiquidationPrice(direction, entryPrice, multiplier);

  const now = new Date().toISOString();
  const tradeId = generateTradeId();

  const trade: OlympTrade = {
    id: tradeId,
    oderId: tradeId,
    userId,
    asset,
    assetType,
    direction,
    investment,
    multiplier,
    volume,
    entryPrice,
    liquidationPrice,
    stopLoss,
    takeProfit,
    spreadCost: spreadCost * investment, // Spread cost in dollars
    currentPrice: entryPrice,
    floatingPnL: -spreadCost * investment, // Start negative due to spread
    floatingPnLPercent: -(spreadCost / investment) * 100,
    status: 'active',
    openedAt: now,
    updatedAt: now,
  };

  return {
    trade,
    requiredBalance: investment,
    error: undefined,
  };
}

/**
 * Update trade with new market price (called every tick)
 * This is the "heartbeat" of the trading engine
 */
export function updateTradePrice(
  trade: OlympTrade,
  currentPrice: number
): TradeUpdateResult {
  const floatingPnL = calculateFloatingPnL(
    trade.direction,
    trade.investment,
    trade.multiplier,
    trade.entryPrice,
    currentPrice
  );

  const floatingPnLPercent = calculatePnLPercent(
    trade.direction,
    trade.multiplier,
    trade.entryPrice,
    currentPrice
  );

  return {
    floatingPnL,
    floatingPnLPercent,
    shouldLiquidate: shouldLiquidate(floatingPnL, trade.investment),
    shouldStopOut: shouldStopOut(trade.direction, currentPrice, trade.stopLoss),
    shouldTakeProfit: shouldTakeProfit(trade.direction, currentPrice, trade.takeProfit),
  };
}

/**
 * Close a trade (manual close, liquidation, SL, or TP)
 * Returns the final P/L
 */
export function closeTrade(
  trade: OlympTrade,
  exitPrice: number,
  closeReason: 'manual' | 'liquidated' | 'stopped_out' | 'take_profit'
): { finalPnL: number; status: OlympTrade['status'] } {
  let finalPnL = calculateFloatingPnL(
    trade.direction,
    trade.investment,
    trade.multiplier,
    trade.entryPrice,
    exitPrice
  );

  // Cap loss at investment (user cannot lose more than they put in)
  if (finalPnL < -trade.investment) {
    finalPnL = -trade.investment;
  }

  const status: OlympTrade['status'] = 
    closeReason === 'liquidated' ? 'liquidated' :
    closeReason === 'stopped_out' ? 'stopped_out' :
    closeReason === 'take_profit' ? 'take_profit' :
    'closed';

  return { finalPnL, status };
}

/**
 * Calculate new balance after trade closes
 * balance_new = balance_old + investment + finalPnL
 * 
 * If trade was profitable: user gets back investment + profit
 * If trade was a loss: user gets back investment - loss
 * If liquidated: user loses entire investment (finalPnL = -investment)
 */
export function calculateNewBalance(
  currentBalance: number,
  investment: number,
  finalPnL: number
): number {
  // The investment was already deducted when trade opened
  // So we add back: investment + finalPnL (which could be negative)
  return currentBalance + investment + finalPnL;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function generateTradeId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TRD-${timestamp}-${random}`;
}

// ==========================================
// SUPABASE INTEGRATION
// ==========================================

/**
 * Save trade to database (atomic operation)
 */
export async function saveTradeToDb(trade: OlympTrade): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('[OlympEngine] Supabase not configured, skipping DB save');
    return false;
  }

  try {
    const { error } = await supabase.from('trades').insert({
      id: trade.id,
      order_id: trade.oderId,
      user_id: trade.userId,
      asset: trade.asset,
      asset_type: trade.assetType,
      direction: trade.direction === 1 ? 'buy' : 'sell',
      investment: trade.investment,
      multiplier: trade.multiplier,
      volume: trade.volume,
      entry_price: trade.entryPrice,
      liquidation_price: trade.liquidationPrice,
      stop_loss: trade.stopLoss,
      take_profit: trade.takeProfit,
      spread_cost: trade.spreadCost,
      current_price: trade.currentPrice,
      floating_pnl: trade.floatingPnL,
      status: trade.status,
      opened_at: trade.openedAt,
      updated_at: trade.updatedAt,
    });

    if (error) {
      console.error('[OlympEngine] Trade save error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[OlympEngine] Trade save exception:', err);
    return false;
  }
}

/**
 * Close trade in database with atomic balance update (TRANSACTION)
 * This is CRITICAL - prevents double-pay or missed deductions
 */
export async function closeTradeInDb(
  trade: OlympTrade,
  exitPrice: number,
  finalPnL: number,
  status: OlympTrade['status']
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    console.log('[OlympEngine] Supabase not configured, skipping DB close');
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Use RPC for atomic transaction (balance update + trade close)
    const { data, error } = await supabase.rpc('close_trade_atomic', {
      p_trade_id: trade.id,
      p_user_id: trade.userId,
      p_exit_price: exitPrice,
      p_final_pnl: finalPnL,
      p_investment: trade.investment,
      p_status: status,
    });

    if (error) {
      console.error('[OlympEngine] Atomic close error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, newBalance: data?.new_balance };
  } catch (err: any) {
    console.error('[OlympEngine] Atomic close exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Deduct investment from balance when opening trade
 */
export async function deductInvestment(
  userId: string,
  investment: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // First get current balance
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('balance_available')
      .eq('id', userId)
      .single();

    if (fetchError || !userData) {
      return { success: false, error: 'User not found' };
    }

    const currentBalance = Number(userData.balance_available) || 0;
    
    if (currentBalance < investment) {
      return { success: false, error: 'Insufficient balance' };
    }

    const newBalance = currentBalance - investment;

    // Update balance atomically
    const { error: updateError } = await supabase
      .from('users')
      .update({
        balance_available: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .eq('balance_available', currentBalance); // Optimistic lock

    if (updateError) {
      return { success: false, error: 'Balance update failed - please retry' };
    }

    return { success: true, newBalance };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Credit balance on trade close (investment + P/L)
 */
export async function creditBalance(
  userId: string,
  investment: number,
  finalPnL: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // Credit = investment + finalPnL (finalPnL can be negative)
    const creditAmount = investment + finalPnL;
    
    // Get current balance
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('balance_available')
      .eq('id', userId)
      .single();

    if (fetchError || !userData) {
      return { success: false, error: 'User not found' };
    }

    const currentBalance = Number(userData.balance_available) || 0;
    const newBalance = Math.max(0, currentBalance + creditAmount);

    // Update balance
    const { error: updateError } = await supabase
      .from('users')
      .update({
        balance_available: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: 'Balance credit failed' };
    }

    return { success: true, newBalance };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// EXPORT ALL
// ==========================================

export const OlympTradingEngine = {
  // Math functions
  getDirection,
  calculateVolume,
  calculateRelativeChange,
  calculateFloatingPnL,
  calculatePnLPercent,
  calculateLiquidationPrice,
  calculateSpreadPrices,
  getEntryPrice,
  getExitPrice,
  
  // Checks
  shouldLiquidate,
  shouldStopOut,
  shouldTakeProfit,
  
  // Trade lifecycle
  createTrade,
  updateTradePrice,
  closeTrade,
  calculateNewBalance,
  
  // Database operations
  saveTradeToDb,
  closeTradeInDb,
  deductInvestment,
  creditBalance,
};

export default OlympTradingEngine;
