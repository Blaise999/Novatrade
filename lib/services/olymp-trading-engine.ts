/**
 * OLYMP-STYLE TRADING ENGINE (PURE)
 *
 * ✅ Pure math + trade lifecycle helpers
 * ❌ No Supabase / DB writes here
 *
 * Model:
 * - Investment (I): cash risked
 * - Multiplier (M): amplifier
 * - Direction (D): +1 buy, -1 sell
 *
 * PnL:
 * - Relative Change = (P_exit - P_entry) / P_entry
 * - PnL = D × I × M × RelativeChange
 *
 * Spread handling (broker edge):
 * - Entry uses Ask for BUY, Bid for SELL
 * - Mark-to-market uses the *exit* side:
 *    BUY marks at Bid
 *    SELL marks at Ask
 */

export type AssetType = 'crypto' | 'forex' | 'stock' | 'commodity';
export type TradeStatus = 'active' | 'closed' | 'liquidated' | 'stopped_out' | 'take_profit';

export interface OlympTrade {
  id: string;
  orderId: string;
  userId: string;

  asset: string;
  assetType: AssetType;
  direction: 1 | -1;

  investment: number;
  multiplier: number;
  volume: number;

  // pricing
  spreadPercent: number;     // e.g. 0.00008
  entryPrice: number;        // ask (buy) or bid (sell)
  liquidationPrice: number;

  stopLoss?: number;
  takeProfit?: number;

  // live mark
  midPrice: number;          // mid
  effectiveExitPrice: number;// bid (buy) / ask (sell)
  floatingPnL: number;
  floatingPnLPercent: number;

  // UI helper: the “flat market” spread loss at open (positive number)
  spreadCostUsd: number;

  status: TradeStatus;

  openedAt: string;
  updatedAt: string;

  closedAt?: string;
  exitPrice?: number;
  finalPnL?: number;
}

export interface TradeOpenParams {
  tradeId?: string;
  userId: string;
  asset: string;
  assetType: AssetType;
  direction: 'buy' | 'sell' | 'up' | 'down';
  investment: number;
  multiplier: number;

  // IMPORTANT: pass MID price here (server should decide this)
  marketMidPrice: number;

  // Spread as fraction of price: 0.00008 means 0.008%
  spreadPercent?: number;

  stopLoss?: number;
  takeProfit?: number;
}

export interface TradeUpdateResult {
  floatingPnL: number;
  floatingPnLPercent: number;
  effectiveExitPrice: number;
  shouldLiquidate: boolean;
  shouldStopOut: boolean;
  shouldTakeProfit: boolean;
}

export const DEFAULT_SPREADS: Record<string, number> = {
  'EUR/USD': 0.00008,
  'GBP/USD': 0.00010,
  'USD/JPY': 0.008,
  'USD/CHF': 0.00012,
  'AUD/USD': 0.00010,
  'USD/CAD': 0.00012,
  'NZD/USD': 0.00012,
  'EUR/GBP': 0.00015,
  'EUR/JPY': 0.012,
  'GBP/JPY': 0.018,
  'BTC/USD': 0.0003,
  'ETH/USD': 0.0004,
  default: 0.0002,
};

// ------------------------------------------
// core helpers
// ------------------------------------------

export function getDirection(input: 'buy' | 'sell' | 'up' | 'down'): 1 | -1 {
  return input === 'buy' || input === 'up' ? 1 : -1;
}

export function calculateVolume(investment: number, multiplier: number): number {
  return investment * multiplier;
}

export function calculateRelativeChange(entryPrice: number, exitPrice: number): number {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) return 0;
  return (exitPrice - entryPrice) / entryPrice;
}

export function calculateFloatingPnL(
  direction: 1 | -1,
  investment: number,
  multiplier: number,
  entryPrice: number,
  exitPrice: number
): number {
  const rc = calculateRelativeChange(entryPrice, exitPrice);
  return direction * investment * multiplier * rc;
}

export function calculatePnLPercent(
  direction: 1 | -1,
  multiplier: number,
  entryPrice: number,
  exitPrice: number
): number {
  const rc = calculateRelativeChange(entryPrice, exitPrice);
  return direction * multiplier * rc * 100;
}

/**
 * Liquidation price where PnL == -investment (100% loss)
 * BUY: entry * (1 - 1/M)
 * SELL: entry * (1 + 1/M)
 */
export function calculateLiquidationPrice(direction: 1 | -1, entryPrice: number, multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return 0;
  return entryPrice * (1 - direction / multiplier);
}

export function shouldLiquidate(floatingPnL: number, investment: number): boolean {
  return floatingPnL <= -investment;
}

export function shouldStopOut(direction: 1 | -1, effectiveExitPrice: number, stopLoss?: number): boolean {
  if (!Number.isFinite(stopLoss as number) || stopLoss == null) return false;
  return direction === 1 ? effectiveExitPrice <= stopLoss : effectiveExitPrice >= stopLoss;
}

export function shouldTakeProfit(direction: 1 | -1, effectiveExitPrice: number, takeProfit?: number): boolean {
  if (!Number.isFinite(takeProfit as number) || takeProfit == null) return false;
  return direction === 1 ? effectiveExitPrice >= takeProfit : effectiveExitPrice <= takeProfit;
}

/**
 * Spread pricing from mid
 * spreadPercent is fraction of price (e.g., 0.00008)
 */
export function calculateSpreadPrices(mid: number, spreadPercent: number) {
  const s = Math.max(0, Number(spreadPercent) || 0);
  const half = mid * s * 0.5;

  const ask = mid + half;
  const bid = mid - half;

  return { ask, bid, spreadAbs: ask - bid };
}

export function getEntryPrice(direction: 1 | -1, mid: number, spreadPercent: number) {
  const { ask, bid } = calculateSpreadPrices(mid, spreadPercent);
  return direction === 1 ? ask : bid;
}

export function getEffectiveExitPrice(direction: 1 | -1, mid: number, spreadPercent: number) {
  const { ask, bid } = calculateSpreadPrices(mid, spreadPercent);
  return direction === 1 ? bid : ask;
}

// ------------------------------------------
// lifecycle
// ------------------------------------------

function makeId(): string {
  try {
    const id = (globalThis as any)?.crypto?.randomUUID?.();
    if (typeof id === 'string' && id.length > 10) return id;
  } catch {}
  return `TRD-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

export function createTrade(params: TradeOpenParams): {
  trade: OlympTrade | null;
  requiredBalance: number;
  error?: string;
} {
  const {
    tradeId,
    userId,
    asset,
    assetType,
    direction: dirInput,
    investment,
    multiplier,
    marketMidPrice,
    spreadPercent = DEFAULT_SPREADS[asset] ?? DEFAULT_SPREADS.default,
    stopLoss,
    takeProfit,
  } = params;

  const inv = Number(investment);
  const mult = Math.trunc(Number(multiplier));
  const mid = Number(marketMidPrice);

  if (!asset || !userId) return { trade: null, requiredBalance: 0, error: 'Missing userId or asset' };
  if (!Number.isFinite(inv) || inv <= 0) return { trade: null, requiredBalance: 0, error: 'Investment must be positive' };
  if (!Number.isFinite(mult) || mult < 1) return { trade: null, requiredBalance: 0, error: 'Multiplier must be at least 1' };
  if (!Number.isFinite(mid) || mid <= 0) return { trade: null, requiredBalance: 0, error: 'Invalid market price' };

  const d = getDirection(dirInput);
  const entry = getEntryPrice(d, mid, spreadPercent);
  const exit0 = getEffectiveExitPrice(d, mid, spreadPercent);

  const volume = calculateVolume(inv, mult);
  const liq = calculateLiquidationPrice(d, entry, mult);

  // Start with correct “flat-market” spread loss
  let floatingPnL = calculateFloatingPnL(d, inv, mult, entry, exit0);
  if (floatingPnL < -inv) floatingPnL = -inv; // cap loss

  const floatingPnLPercent = inv > 0 ? (floatingPnL / inv) * 100 : 0;
  const spreadCostUsd = Math.max(0, -floatingPnL);

  const now = new Date().toISOString();
  const id = tradeId || makeId();

  const trade: OlympTrade = {
    id,
    orderId: id,
    userId,
    asset,
    assetType,
    direction: d,
    investment: inv,
    multiplier: mult,
    volume,
    spreadPercent,
    entryPrice: entry,
    liquidationPrice: liq,
    stopLoss: stopLoss,
    takeProfit: takeProfit,
    midPrice: mid,
    effectiveExitPrice: exit0,
    floatingPnL,
    floatingPnLPercent,
    spreadCostUsd,
    status: 'active',
    openedAt: now,
    updatedAt: now,
  };

  return { trade, requiredBalance: inv };
}

export function updateTradeWithMidPrice(trade: OlympTrade, newMid: number): TradeUpdateResult {
  const mid = Number(newMid);
  if (!Number.isFinite(mid) || mid <= 0) {
    return {
      floatingPnL: trade.floatingPnL,
      floatingPnLPercent: trade.floatingPnLPercent,
      effectiveExitPrice: trade.effectiveExitPrice,
      shouldLiquidate: false,
      shouldStopOut: false,
      shouldTakeProfit: false,
    };
  }

  const exit = getEffectiveExitPrice(trade.direction, mid, trade.spreadPercent);

  let pnl = calculateFloatingPnL(
    trade.direction,
    trade.investment,
    trade.multiplier,
    trade.entryPrice,
    exit
  );

  // cap loss at -investment
  if (pnl < -trade.investment) pnl = -trade.investment;

  const pnlPct = trade.investment > 0 ? (pnl / trade.investment) * 100 : 0;

  return {
    floatingPnL: pnl,
    floatingPnLPercent: pnlPct,
    effectiveExitPrice: exit,
    shouldLiquidate: shouldLiquidate(pnl, trade.investment),
    shouldStopOut: shouldStopOut(trade.direction, exit, trade.stopLoss),
    shouldTakeProfit: shouldTakeProfit(trade.direction, exit, trade.takeProfit),
  };
}

export function closeTradeAtMidPrice(
  trade: OlympTrade,
  midPrice: number,
  closeReason: 'manual' | 'liquidated' | 'stopped_out' | 'take_profit'
): { finalPnL: number; status: TradeStatus; exitPrice: number } {
  const exit = getEffectiveExitPrice(trade.direction, midPrice, trade.spreadPercent);

  let pnl = calculateFloatingPnL(
    trade.direction,
    trade.investment,
    trade.multiplier,
    trade.entryPrice,
    exit
  );

  if (pnl < -trade.investment) pnl = -trade.investment;

  const status: TradeStatus =
    closeReason === 'liquidated' ? 'liquidated'
    : closeReason === 'stopped_out' ? 'stopped_out'
    : closeReason === 'take_profit' ? 'take_profit'
    : 'closed';

  return { finalPnL: pnl, status, exitPrice: exit };
}

/**
 * balance_new = balance_old + investment + finalPnL
 * (because investment was deducted at open)
 */
export function calculateNewBalance(currentBalance: number, investment: number, finalPnL: number): number {
  return currentBalance + investment + finalPnL;
}

const OlympTradingEngine = {
  DEFAULT_SPREADS,
  getDirection,
  calculateVolume,
  calculateRelativeChange,
  calculateFloatingPnL,
  calculatePnLPercent,
  calculateLiquidationPrice,
  calculateSpreadPrices,
  getEntryPrice,
  getEffectiveExitPrice,
  shouldLiquidate,
  shouldStopOut,
  shouldTakeProfit,
  createTrade,
  updateTradeWithMidPrice,
  closeTradeAtMidPrice,
  calculateNewBalance,
};

export default OlympTradingEngine;
