/**
 * FX TRADING ENGINE (OLYMP-STYLE)
 * ================================
 * 
 * This replaces the complex pip-based FX trading with a simpler model:
 * 
 * CORE CONCEPT:
 * - Investment (I): Actual cash user risks (e.g., $100)
 * - Multiplier (M): Leverage (e.g., x100)
 * - Direction (D): +1 for Buy/Long, -1 for Sell/Short
 * 
 * FORMULAS:
 * - Floating P/L = D × I × M × ((P_current - P_entry) / P_entry)
 * - Liquidation = when P/L <= -Investment (100% loss)
 * - Liquidation Price = P_entry × (1 - D/M)
 * 
 * CRITICAL:
 * - Server-side execution ONLY
 * - All balance changes through atomic DB operations
 * - No local balance modifications
 */

// ==========================================
// TYPES
// ==========================================

export interface FXTrade {
  id: string;
  userId: string;
  
  // Asset
  symbol: string;
  name?: string;
  
  // Direction: 1 = Buy/Long, -1 = Sell/Short
  direction: 1 | -1;
  directionLabel: 'buy' | 'sell';
  
  // Financial
  investment: number;      // Actual $ at risk
  multiplier: number;      // Leverage (x10, x100, etc)
  volume: number;          // I × M (notional)
  entryPrice: number;
  
  // Risk Management
  liquidationPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  
  // Current State
  currentPrice: number;
  floatingPnL: number;
  floatingPnLPercent: number;
  
  // Spread
  spreadCost: number;
  
  // Status
  status: 'active' | 'closed' | 'liquidated' | 'stopped_out' | 'take_profit';
  
  // Times
  openedAt: string;
  closedAt?: string;
  updatedAt: string;
  
  // Final (when closed)
  exitPrice?: number;
  finalPnL?: number;
}

export interface TradeOpenRequest {
  symbol: string;
  name?: string;
  direction: 'buy' | 'sell' | 'long' | 'short';
  investment: number;
  multiplier: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  spreadPercent?: number;
}

export interface TradeCloseRequest {
  tradeId: string;
  exitPrice: number;
  reason?: 'manual' | 'liquidated' | 'stopped_out' | 'take_profit';
}

// ==========================================
// SPREAD CONFIGURATION
// ==========================================

const FX_SPREADS: Record<string, number> = {
  'EUR/USD': 0.00008,
  'GBP/USD': 0.00012,
  'USD/JPY': 0.008,
  'USD/CHF': 0.00015,
  'AUD/USD': 0.00012,
  'USD/CAD': 0.00015,
  'NZD/USD': 0.00015,
  'EUR/GBP': 0.00018,
  'EUR/JPY': 0.015,
  'GBP/JPY': 0.02,
  'EUR/CHF': 0.00018,
  'CHF/JPY': 0.02,
  'AUD/JPY': 0.015,
  'CAD/JPY': 0.015,
  'default': 0.0002,
};

export function getSpreadForSymbol(symbol: string): number {
  return FX_SPREADS[symbol] || FX_SPREADS.default;
}

// ==========================================
// CORE MATH
// ==========================================

/**
 * Convert direction string to number
 */
export function parseDirection(input: string): 1 | -1 {
  const lower = input.toLowerCase();
  return (lower === 'buy' || lower === 'long') ? 1 : -1;
}

/**
 * Get direction label
 */
export function getDirectionLabel(d: 1 | -1): 'buy' | 'sell' {
  return d === 1 ? 'buy' : 'sell';
}

/**
 * Calculate floating P/L
 * Formula: D × I × M × ((P_current - P_entry) / P_entry)
 */
export function calculatePnL(
  direction: 1 | -1,
  investment: number,
  multiplier: number,
  entryPrice: number,
  currentPrice: number
): number {
  if (entryPrice <= 0) return 0;
  const relativeChange = (currentPrice - entryPrice) / entryPrice;
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
  if (entryPrice <= 0) return 0;
  const relativeChange = (currentPrice - entryPrice) / entryPrice;
  return direction * multiplier * relativeChange * 100;
}

/**
 * Calculate liquidation price
 * This is where P/L = -Investment (100% loss)
 * 
 * For BUY:  P_liq = P_entry × (1 - 1/M)
 * For SELL: P_liq = P_entry × (1 + 1/M)
 */
export function calculateLiquidationPrice(
  direction: 1 | -1,
  entryPrice: number,
  multiplier: number
): number {
  if (multiplier <= 0) return 0;
  return entryPrice * (1 - (direction / multiplier));
}

/**
 * Get entry price with spread
 * BUY enters at Ask (higher price)
 * SELL enters at Bid (lower price)
 */
export function getEntryPriceWithSpread(
  direction: 1 | -1,
  midPrice: number,
  spreadPercent: number
): number {
  const halfSpread = midPrice * spreadPercent / 2;
  return direction === 1 ? midPrice + halfSpread : midPrice - halfSpread;
}

/**
 * Get exit price with spread
 * BUY exits at Bid (lower price)
 * SELL exits at Ask (higher price)
 */
export function getExitPriceWithSpread(
  direction: 1 | -1,
  midPrice: number,
  spreadPercent: number
): number {
  const halfSpread = midPrice * spreadPercent / 2;
  return direction === 1 ? midPrice - halfSpread : midPrice + halfSpread;
}

// ==========================================
// TRIGGER CHECKS
// ==========================================

/**
 * Check if position should be liquidated
 * Rule: P/L <= -Investment
 */
export function shouldLiquidate(floatingPnL: number, investment: number): boolean {
  return floatingPnL <= -investment;
}

/**
 * Check if stop loss triggered
 */
export function shouldStopLoss(
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
 * Check if take profit triggered
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

// ==========================================
// TRADE CREATION
// ==========================================

/**
 * Generate a UUID-compatible trade ID
 */
function generateTradeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create a new trade object
 */
export function createFXTrade(
  userId: string,
  request: TradeOpenRequest
): { trade: FXTrade; error?: string } {
  // Validation
  if (request.investment <= 0) {
    return { trade: null as any, error: 'Investment must be positive' };
  }
  if (request.multiplier < 1 || request.multiplier > 1000) {
    return { trade: null as any, error: 'Multiplier must be between 1 and 1000' };
  }
  if (request.currentPrice <= 0) {
    return { trade: null as any, error: 'Invalid price' };
  }
  
  const direction = parseDirection(request.direction);
  const spreadPercent = request.spreadPercent ?? getSpreadForSymbol(request.symbol);
  const entryPrice = getEntryPriceWithSpread(direction, request.currentPrice, spreadPercent);
  const liquidationPrice = calculateLiquidationPrice(direction, entryPrice, request.multiplier);
  const volume = request.investment * request.multiplier;
  
  // Spread cost in dollars (user starts slightly negative)
  const spreadCost = request.investment * spreadPercent * request.multiplier;
  
  const now = new Date().toISOString();
  
  const trade: FXTrade = {
    id: generateTradeId(),
    userId,
    symbol: request.symbol,
    name: request.name,
    direction,
    directionLabel: getDirectionLabel(direction),
    investment: request.investment,
    multiplier: request.multiplier,
    volume,
    entryPrice,
    liquidationPrice,
    stopLoss: request.stopLoss,
    takeProfit: request.takeProfit,
    currentPrice: entryPrice,
    floatingPnL: -spreadCost, // Start negative due to spread
    floatingPnLPercent: -(spreadPercent * request.multiplier * 100),
    spreadCost,
    status: 'active',
    openedAt: now,
    updatedAt: now,
  };
  
  return { trade };
}

/**
 * Update trade with new price tick
 */
export function updateFXTradePrice(
  trade: FXTrade,
  currentPrice: number
): {
  updatedTrade: FXTrade;
  shouldLiquidate: boolean;
  shouldStopLoss: boolean;
  shouldTakeProfit: boolean;
} {
  const floatingPnL = calculatePnL(
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
  
  const updatedTrade: FXTrade = {
    ...trade,
    currentPrice,
    floatingPnL,
    floatingPnLPercent,
    updatedAt: new Date().toISOString(),
  };
  
  return {
    updatedTrade,
    shouldLiquidate: shouldLiquidate(floatingPnL, trade.investment),
    shouldStopLoss: shouldStopLoss(trade.direction, currentPrice, trade.stopLoss),
    shouldTakeProfit: shouldTakeProfit(trade.direction, currentPrice, trade.takeProfit),
  };
}

/**
 * Close a trade and calculate final P/L
 */
export function closeFXTrade(
  trade: FXTrade,
  exitPrice: number,
  reason: 'manual' | 'liquidated' | 'stopped_out' | 'take_profit' = 'manual'
): FXTrade {
  let finalPnL = calculatePnL(
    trade.direction,
    trade.investment,
    trade.multiplier,
    trade.entryPrice,
    exitPrice
  );
  
  // Cap loss at investment (cannot lose more than risked)
  if (finalPnL < -trade.investment) {
    finalPnL = -trade.investment;
  }
  
  const status: FXTrade['status'] = 
    reason === 'liquidated' ? 'liquidated' :
    reason === 'stopped_out' ? 'stopped_out' :
    reason === 'take_profit' ? 'take_profit' :
    'closed';
  
  return {
    ...trade,
    currentPrice: exitPrice,
    exitPrice,
    finalPnL,
    floatingPnL: finalPnL,
    floatingPnLPercent: (finalPnL / trade.investment) * 100,
    status,
    closedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ==========================================
// BALANCE CALCULATIONS
// ==========================================

/**
 * Calculate balance change when opening a trade
 * (Investment is locked, balance decreases)
 */
export function calculateOpenTradeBalanceChange(investment: number): number {
  return -investment;
}

/**
 * Calculate balance change when closing a trade
 * (Investment + P/L returned)
 */
export function calculateCloseTradeBalanceChange(investment: number, finalPnL: number): number {
  return investment + finalPnL;
}

// ==========================================
// DATABASE ROW CONVERSION
// ==========================================

/**
 * Convert FXTrade to database row format
 */
export function tradeToDbRow(trade: FXTrade): Record<string, any> {
  return {
    id: trade.id,
    user_id: trade.userId,
    market_type: 'fx',
    asset_type: 'forex',
    pair: trade.symbol,
    symbol: trade.symbol,
    direction: trade.directionLabel,
    direction_int: trade.direction,
    type: trade.directionLabel,
    amount: trade.investment,
    investment: trade.investment,
    multiplier: trade.multiplier,
    leverage: trade.multiplier,
    volume: trade.volume,
    entry_price: trade.entryPrice,
    liquidation_price: trade.liquidationPrice,
    stop_loss: trade.stopLoss || null,
    take_profit: trade.takeProfit || null,
    current_price: trade.currentPrice,
    exit_price: trade.exitPrice || null,
    floating_pnl: trade.floatingPnL,
    pnl: trade.finalPnL || null,
    profit_loss: trade.finalPnL || null,
    spread_cost: trade.spreadCost,
    status: trade.status === 'active' ? 'open' : trade.status,
    opened_at: trade.openedAt,
    closed_at: trade.closedAt || null,
    updated_at: trade.updatedAt,
    is_simulated: true,
  };
}

/**
 * Convert database row to FXTrade
 */
export function dbRowToTrade(row: any): FXTrade {
  const direction = row.direction_int ?? (
    ['buy', 'long'].includes(String(row.direction || row.type).toLowerCase()) ? 1 : -1
  );
  
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol || row.pair,
    name: row.name,
    direction: direction as 1 | -1,
    directionLabel: direction === 1 ? 'buy' : 'sell',
    investment: Number(row.investment || row.amount || 0),
    multiplier: Number(row.multiplier || row.leverage || 1),
    volume: Number(row.volume || 0),
    entryPrice: Number(row.entry_price || 0),
    liquidationPrice: Number(row.liquidation_price || 0),
    stopLoss: row.stop_loss ? Number(row.stop_loss) : undefined,
    takeProfit: row.take_profit ? Number(row.take_profit) : undefined,
    currentPrice: Number(row.current_price || row.entry_price || 0),
    floatingPnL: Number(row.floating_pnl || row.pnl || 0),
    floatingPnLPercent: 0, // Recalculate
    spreadCost: Number(row.spread_cost || 0),
    status: row.status === 'open' ? 'active' : row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    updatedAt: row.updated_at,
    exitPrice: row.exit_price ? Number(row.exit_price) : undefined,
    finalPnL: row.pnl ? Number(row.pnl) : undefined,
  };
}

// ==========================================
// EXPORT
// ==========================================

export const FXTradingEngine = {
  // Spread
  getSpreadForSymbol,
  
  // Direction
  parseDirection,
  getDirectionLabel,
  
  // Math
  calculatePnL,
  calculatePnLPercent,
  calculateLiquidationPrice,
  getEntryPriceWithSpread,
  getExitPriceWithSpread,
  
  // Triggers
  shouldLiquidate,
  shouldStopLoss,
  shouldTakeProfit,
  
  // Trade lifecycle
  createFXTrade,
  updateFXTradePrice,
  closeFXTrade,
  
  // Balance
  calculateOpenTradeBalanceChange,
  calculateCloseTradeBalanceChange,
  
  // DB conversion
  tradeToDbRow,
  dbRowToTrade,
};

export default FXTradingEngine;
