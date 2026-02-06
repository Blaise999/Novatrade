// ============================================
// BOT TRADING TYPES & HELPERS
// ============================================

export type BotType = 'dca' | 'grid';
export type BotStatus = 'running' | 'paused' | 'stopped' | 'error';
export type GridType = 'arithmetic' | 'geometric';
export type GridStrategy = 'neutral' | 'long' | 'short';
export type DCAFrequency = '1m' | '5m' | '15m' | '1h' | '4h' | '12h' | 'daily' | 'weekly' | 'monthly';
export type OrderSide = 'buy' | 'sell';
export type OrderRole =
  | 'dca_base' | 'dca_safety' | 'dca_take_profit' | 'dca_stop_loss'
  | 'grid_buy' | 'grid_sell';

// ----- Core records -----

export interface TradingBot {
  id: string;
  user_id: string;
  bot_type: BotType;
  name: string;
  pair: string;
  status: BotStatus;
  invested_amount: number;
  current_value: number;
  total_pnl: number;
  total_trades: number;
  error_message?: string;
  started_at?: string;
  stopped_at?: string;
  created_at: string;
  updated_at: string;
  // Joined
  dca_config?: DCABotConfig;
  grid_config?: GridBotConfig;
  grid_levels?: GridLevel[];
}

export interface DCABotConfig {
  id: string;
  bot_id: string;
  order_amount: number;
  frequency: DCAFrequency;
  take_profit_pct: number;
  stop_loss_pct?: number;
  trailing_tp_enabled: boolean;
  trailing_tp_deviation: number;
  safety_orders_enabled: boolean;
  max_safety_orders: number;
  safety_order_size: number;
  safety_order_step_pct: number;
  safety_order_step_scale: number;
  safety_order_volume_scale: number;
  // Runtime
  current_avg_price: number;
  total_base_bought: number;
  total_quote_spent: number;
  active_safety_count: number;
  peak_profit_pct: number;
  deal_count: number;
  last_buy_at?: string;
}

export interface GridBotConfig {
  id: string;
  bot_id: string;
  upper_price: number;
  lower_price: number;
  grid_count: number;
  grid_type: GridType;
  total_investment: number;
  per_grid_amount: number;
  strategy: GridStrategy;
  stop_upper_price?: number;
  stop_lower_price?: number;
  // Runtime
  grid_profit: number;
  float_pnl: number;
  total_base_held: number;
  avg_buy_price: number;
  completed_cycles: number;
}

export interface GridLevel {
  id: string;
  bot_id: string;
  level_index: number;
  price: number;
  buy_filled: boolean;
  sell_filled: boolean;
  buy_order_id?: string;
  sell_order_id?: string;
}

export interface BotOrder {
  id: string;
  bot_id: string;
  user_id: string;
  pair: string;
  side: OrderSide;
  role: OrderRole;
  quantity: number;
  price: number;
  total: number;
  fee: number;
  status: 'pending' | 'filled' | 'cancelled';
  grid_level?: number;
  safety_level?: number;
  created_at: string;
}

export interface BotActivityEntry {
  id: string;
  bot_id: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
}

// ----- Helper functions -----

export function frequencyToMs(freq: DCAFrequency): number {
  const map: Record<DCAFrequency, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '12h': 43_200_000,
    'daily': 86_400_000,
    'weekly': 604_800_000,
    'monthly': 2_592_000_000,
  };
  return map[freq] ?? 3_600_000;
}

export function frequencyLabel(freq: DCAFrequency): string {
  const map: Record<DCAFrequency, string> = {
    '1m': 'Every 1 min', '5m': 'Every 5 min', '15m': 'Every 15 min',
    '1h': 'Hourly', '4h': 'Every 4 hours', '12h': 'Every 12 hours',
    'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly',
  };
  return map[freq] ?? freq;
}

/** Arithmetic grid: equally spaced by $ amount */
export function generateArithmeticGrid(lower: number, upper: number, count: number): number[] {
  const step = (upper - lower) / (count - 1);
  return Array.from({ length: count }, (_, i) => +(lower + i * step).toFixed(8));
}

/** Geometric grid: equally spaced by % ratio */
export function generateGeometricGrid(lower: number, upper: number, count: number): number[] {
  const ratio = Math.pow(upper / lower, 1 / (count - 1));
  return Array.from({ length: count }, (_, i) => +(lower * Math.pow(ratio, i)).toFixed(8));
}

/** Weighted average buy price */
export function calculateDCAAvgPrice(totalQuoteSpent: number, totalBaseBought: number): number {
  return totalBaseBought > 0 ? totalQuoteSpent / totalBaseBought : 0;
}

/** Price at which the next safety order triggers (below avg) */
export function calculateNextSafetyPrice(
  avgPrice: number,
  stepPct: number,
  stepScale: number,
  level: number,
): number {
  let totalDrop = 0;
  for (let i = 0; i < level; i++) {
    totalDrop += stepPct * Math.pow(stepScale, i);
  }
  return avgPrice * (1 - totalDrop / 100);
}

/** Safety order size at a given level (Martingale) */
export function calculateSafetyOrderSize(
  baseSize: number,
  volumeScale: number,
  level: number,
): number {
  return baseSize * Math.pow(volumeScale, level);
}

/** Grid profit for one completed buy→sell cycle */
export function calculateGridProfitPerCycle(
  buyPrice: number,
  sellPrice: number,
  quantity: number,
  feePct = 0.1,
): number {
  const gross = (sellPrice - buyPrice) * quantity;
  const fee = (buyPrice * quantity + sellPrice * quantity) * (feePct / 100);
  return gross - fee;
}
