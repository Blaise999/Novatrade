'use client';

/**
 * BOT TRADING ENGINE
 *
 * Client-side Zustand store that drives both DCA and Grid bots.
 * – Polls live prices via Binance REST (fallback: simulated)
 * – Persists every state change to Supabase
 * – Exposes start / stop / pause controls and reactive state
 *
 * Architecture note:
 *   In production you'd run this server-side in a cron/queue worker.
 *   For the current platform, the client-side interval mirrors
 *   how the existing trading-engine.ts already works.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import {
  type TradingBot,
  type DCABotConfig,
  type GridBotConfig,
  type GridLevel,
  type BotOrder,
  type BotActivityEntry,
  type BotType,
  type BotStatus,
  type DCAFrequency,
  type GridType,
  type GridStrategy,
  type OrderRole,
  frequencyToMs,
  generateArithmeticGrid,
  generateGeometricGrid,
  calculateDCAAvgPrice,
  calculateNextSafetyPrice,
  calculateSafetyOrderSize,
  calculateGridProfitPerCycle,
} from '@/lib/bot-trading-types';

// ============================================
// PRICE SERVICE
// ============================================

/** Normalise "BTC/USDT" → "BTCUSDT" for Binance */
function toBinanceSymbol(pair: string): string {
  return pair.replace(/[\/\-_ ]/g, '').toUpperCase();
}

/** Fetch current mid-price from Binance REST (public, no key needed) */
async function fetchPrice(pair: string): Promise<number> {
  try {
    const sym = toBinanceSymbol(pair);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
    if (!res.ok) throw new Error('binance-err');
    const json = await res.json();
    return parseFloat(json.price);
  } catch {
    // Fallback: simulated random walk around a base price
    return simulatedPrice(pair);
  }
}

const _sim: Record<string, number> = {};
function simulatedPrice(pair: string): number {
  const base: Record<string, number> = {
    'BTC/USDT': 97500, 'ETH/USDT': 3450, 'SOL/USDT': 188,
    'BNB/USDT': 620, 'XRP/USDT': 2.35, 'DOGE/USDT': 0.32,
  };
  if (!_sim[pair]) _sim[pair] = base[pair] ?? 100;
  _sim[pair] *= 1 + (Math.random() - 0.498) * 0.004; // slight drift
  return +_sim[pair].toFixed(8);
}

// ============================================
// SUPABASE HELPERS
// ============================================

async function dbInsert<T>(table: string, row: Record<string, any>): Promise<T | null> {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) console.error(`[BotEngine] insert ${table}:`, error.message);
  return (data as T) ?? null;
}

async function dbUpdate(table: string, id: string, patch: Record<string, any>) {
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) console.error(`[BotEngine] update ${table}:`, error.message);
}

async function dbUpsertGridLevel(level: Partial<GridLevel> & { id: string }) {
  const { error } = await supabase.from('grid_levels').update(level).eq('id', level.id);
  if (error) console.error('[BotEngine] grid_levels update:', error.message);
}

async function logActivity(botId: string, action: string, details?: Record<string, any>) {
  await supabase.from('bot_activity_log').insert({ bot_id: botId, action, details });
}

// ============================================
// FEE
// ============================================
const FEE_PCT = 0.1; // 0.1 % per side

// ============================================
// BALANCE INTEGRATION
// ============================================

/** Deduct amount from user balance (for bot buys) */
async function deductBalance(userId: string, amount: number): Promise<boolean> {
  try {
    const { data: u } = await supabase.from('users').select('balance_available').eq('id', userId).maybeSingle();
    if (!u) return false;
    const current = Number(u.balance_available ?? 0);
    if (current < amount) return false; // insufficient funds
    await supabase.from('users').update({ balance_available: +(current - amount).toFixed(2) }).eq('id', userId);
    return true;
  } catch { return false; }
}

/** Credit amount to user balance (for bot sells / profit) */
async function creditBalance(userId: string, amount: number): Promise<void> {
  try {
    const { data: u } = await supabase.from('users').select('balance_available').eq('id', userId).maybeSingle();
    if (!u) return;
    const current = Number(u.balance_available ?? 0);
    await supabase.from('users').update({ balance_available: +(current + amount).toFixed(2) }).eq('id', userId);
  } catch {}
}

/** Insert a record into the trades table for trade history */
async function insertTradeHistory(params: {
  userId: string; pair: string; side: 'buy' | 'sell'; role: string;
  amount: number; price: number; pnl: number; botName: string;
}): Promise<void> {
  try {
    await supabase.from('trades').insert({
      user_id: params.userId,
      pair: params.pair,
      market_type: 'crypto',
      type: 'bot',
      side: params.side === 'buy' ? 'up' : 'down',
      amount: Math.abs(params.amount),
      entry_price: params.price,
      exit_price: params.price,
      leverage: 1,
      pnl: params.pnl,
      pnl_percentage: params.amount > 0 ? (params.pnl / params.amount) * 100 : 0,
      fees: Math.abs(params.amount) * (FEE_PCT / 100),
      status: 'closed',
      close_reason: `${params.role} (${params.botName})`,
      created_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
    });
  } catch {}
}

// ============================================
// ZUSTAND STORE
// ============================================

interface BotEngineState {
  bots: TradingBot[];
  loading: boolean;
  error: string | null;
  // -- intervals keyed by bot id
  _intervals: Record<string, ReturnType<typeof setInterval>>;

  // -- CRUD
  fetchBots: (userId: string) => Promise<void>;
  fetchBotDetail: (botId: string) => Promise<TradingBot | null>;
  createDCABot: (p: CreateDCAParams) => Promise<TradingBot | null>;
  createGridBot: (p: CreateGridParams) => Promise<TradingBot | null>;
  deleteBot: (botId: string) => Promise<void>;

  // -- Controls
  startBot: (botId: string) => void;
  pauseBot: (botId: string) => void;
  stopBot: (botId: string) => void;

  // -- Internal tickers
  _tickDCA: (botId: string) => Promise<void>;
  _tickGrid: (botId: string) => Promise<void>;
}

export interface CreateDCAParams {
  userId: string;
  name: string;
  pair: string;
  orderAmount: number;
  frequency: DCAFrequency;
  takeProfitPct: number;
  stopLossPct?: number;
  trailingTpEnabled?: boolean;
  trailingTpDeviation?: number;
  safetyOrdersEnabled?: boolean;
  maxSafetyOrders?: number;
  safetyOrderSize?: number;
  safetyOrderStepPct?: number;
  safetyOrderStepScale?: number;
  safetyOrderVolumeScale?: number;
}

export interface CreateGridParams {
  userId: string;
  name: string;
  pair: string;
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  gridType: GridType;
  totalInvestment: number;
  strategy: GridStrategy;
  stopUpperPrice?: number;
  stopLowerPrice?: number;
}

export const useBotEngine = create<BotEngineState>((set, get) => ({
  bots: [],
  loading: false,
  error: null,
  _intervals: {},

  // ============================
  // FETCH
  // ============================

  fetchBots: async (userId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    const bots = (data ?? []) as TradingBot[];

    // Hydrate configs in parallel
    await Promise.all(bots.map(async (b) => {
      if (b.bot_type === 'dca') {
        const { data: cfg } = await supabase.from('dca_bot_config').select('*').eq('bot_id', b.id).single();
        if (cfg) b.dca_config = cfg as DCABotConfig;
      } else {
        const { data: cfg } = await supabase.from('grid_bot_config').select('*').eq('bot_id', b.id).single();
        if (cfg) b.grid_config = cfg as GridBotConfig;
        const { data: lvls } = await supabase.from('grid_levels').select('*').eq('bot_id', b.id).order('level_index');
        if (lvls) b.grid_levels = lvls as GridLevel[];
      }
    }));

    set({ bots, loading: false });

    // Auto-resume running bots
    bots.filter(b => b.status === 'running').forEach(b => get().startBot(b.id));
  },

  fetchBotDetail: async (botId) => {
    const { data: bot } = await supabase.from('trading_bots').select('*').eq('id', botId).single();
    if (!bot) return null;
    const b = bot as TradingBot;
    if (b.bot_type === 'dca') {
      const { data: cfg } = await supabase.from('dca_bot_config').select('*').eq('bot_id', b.id).single();
      b.dca_config = (cfg as DCABotConfig) ?? undefined;
    } else {
      const { data: cfg } = await supabase.from('grid_bot_config').select('*').eq('bot_id', b.id).single();
      b.grid_config = (cfg as GridBotConfig) ?? undefined;
      const { data: lvls } = await supabase.from('grid_levels').select('*').eq('bot_id', b.id).order('level_index');
      b.grid_levels = (lvls as GridLevel[]) ?? [];
    }
    return b;
  },

  // ============================
  // CREATE DCA BOT
  // ============================

  createDCABot: async (p) => {
    const bot = await dbInsert<TradingBot>('trading_bots', {
      user_id: p.userId,
      bot_type: 'dca',
      name: p.name,
      pair: p.pair,
      status: 'stopped',
      invested_amount: 0,
    });
    if (!bot) return null;

    const cfg = await dbInsert<DCABotConfig>('dca_bot_config', {
      bot_id: bot.id,
      order_amount: p.orderAmount,
      frequency: p.frequency,
      take_profit_pct: p.takeProfitPct,
      stop_loss_pct: p.stopLossPct ?? null,
      trailing_tp_enabled: p.trailingTpEnabled ?? false,
      trailing_tp_deviation: p.trailingTpDeviation ?? 1.0,
      safety_orders_enabled: p.safetyOrdersEnabled ?? false,
      max_safety_orders: p.maxSafetyOrders ?? 5,
      safety_order_size: p.safetyOrderSize ?? p.orderAmount,
      safety_order_step_pct: p.safetyOrderStepPct ?? 2.0,
      safety_order_step_scale: p.safetyOrderStepScale ?? 1.0,
      safety_order_volume_scale: p.safetyOrderVolumeScale ?? 1.5,
    });
    bot.dca_config = cfg ?? undefined;
    await logActivity(bot.id, 'created', { type: 'dca', pair: p.pair });

    set(s => ({ bots: [bot, ...s.bots] }));
    return bot;
  },

  // ============================
  // CREATE GRID BOT
  // ============================

  createGridBot: async (p) => {
    const bot = await dbInsert<TradingBot>('trading_bots', {
      user_id: p.userId,
      bot_type: 'grid',
      name: p.name,
      pair: p.pair,
      status: 'stopped',
      invested_amount: p.totalInvestment,
    });
    if (!bot) return null;

    const perGrid = +(p.totalInvestment / p.gridCount).toFixed(8);
    const cfg = await dbInsert<GridBotConfig>('grid_bot_config', {
      bot_id: bot.id,
      upper_price: p.upperPrice,
      lower_price: p.lowerPrice,
      grid_count: p.gridCount,
      grid_type: p.gridType,
      total_investment: p.totalInvestment,
      per_grid_amount: perGrid,
      strategy: p.strategy,
      stop_upper_price: p.stopUpperPrice ?? null,
      stop_lower_price: p.stopLowerPrice ?? null,
    });
    bot.grid_config = cfg ?? undefined;

    // Generate levels
    const prices =
      p.gridType === 'geometric'
        ? generateGeometricGrid(p.lowerPrice, p.upperPrice, p.gridCount)
        : generateArithmeticGrid(p.lowerPrice, p.upperPrice, p.gridCount);

    const levels: GridLevel[] = [];
    for (let i = 0; i < prices.length; i++) {
      const lv = await dbInsert<GridLevel>('grid_levels', {
        bot_id: bot.id,
        level_index: i,
        price: prices[i],
      });
      if (lv) levels.push(lv);
    }
    bot.grid_levels = levels;
    await logActivity(bot.id, 'created', { type: 'grid', pair: p.pair, gridCount: p.gridCount });

    set(s => ({ bots: [bot, ...s.bots] }));
    return bot;
  },

  // ============================
  // DELETE
  // ============================

  deleteBot: async (botId) => {
    const bot = get().bots.find(b => b.id === botId);
    if (bot?.status === 'running') get().stopBot(botId);

    // Cascade deletes handle child rows
    await supabase.from('trading_bots').delete().eq('id', botId);
    set(s => ({ bots: s.bots.filter(b => b.id !== botId) }));
  },

  // ============================
  // CONTROLS
  // ============================

  startBot: (botId) => {
    const { _intervals, bots } = get();
    if (_intervals[botId]) return; // already ticking

    const bot = bots.find(b => b.id === botId);
    if (!bot) return;

    const intervalMs = bot.bot_type === 'dca'
      ? Math.max(frequencyToMs(bot.dca_config?.frequency ?? '1h'), 5000)
      : 5000; // grid polls every 5 s

    // Immediate first tick
    if (bot.bot_type === 'dca') get()._tickDCA(botId);
    else get()._tickGrid(botId);

    const iv = setInterval(() => {
      if (bot.bot_type === 'dca') get()._tickDCA(botId);
      else get()._tickGrid(botId);
    }, intervalMs);

    set(s => ({
      _intervals: { ...s._intervals, [botId]: iv },
      bots: s.bots.map(b => b.id === botId ? { ...b, status: 'running' as BotStatus, started_at: new Date().toISOString() } : b),
    }));

    dbUpdate('trading_bots', botId, { status: 'running', started_at: new Date().toISOString() });
    logActivity(botId, 'started');
  },

  pauseBot: (botId) => {
    const iv = get()._intervals[botId];
    if (iv) clearInterval(iv);
    const copy = { ...get()._intervals };
    delete copy[botId];

    set(s => ({
      _intervals: copy,
      bots: s.bots.map(b => b.id === botId ? { ...b, status: 'paused' as BotStatus } : b),
    }));

    dbUpdate('trading_bots', botId, { status: 'paused' });
    logActivity(botId, 'paused');
  },

  stopBot: (botId) => {
    const iv = get()._intervals[botId];
    if (iv) clearInterval(iv);
    const copy = { ...get()._intervals };
    delete copy[botId];

    set(s => ({
      _intervals: copy,
      bots: s.bots.map(b => b.id === botId ? { ...b, status: 'stopped' as BotStatus, stopped_at: new Date().toISOString() } : b),
    }));

    dbUpdate('trading_bots', botId, { status: 'stopped', stopped_at: new Date().toISOString() });
    logActivity(botId, 'stopped');
  },

  // ============================
  // DCA TICK
  // ============================

  _tickDCA: async (botId) => {
    const bot = get().bots.find(b => b.id === botId);
    if (!bot || bot.status !== 'running' || !bot.dca_config) return;
    const cfg = bot.dca_config;

    const price = await fetchPrice(bot.pair);
    if (!price || price <= 0) return;

    let newBaseBought = cfg.total_base_bought;
    let newQuoteSpent = cfg.total_quote_spent;
    let newSafetyCount = cfg.active_safety_count;
    let newPeak = cfg.peak_profit_pct;
    let newDealCount = cfg.deal_count;
    let newTotalPnl = bot.total_pnl;
    let newTrades = bot.total_trades;
    let invested = bot.invested_amount;

    const avgPrice = calculateDCAAvgPrice(newQuoteSpent, newBaseBought);
    const positionValue = newBaseBought * price;
    const profitPct = avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0;

    // ---- TAKE PROFIT ----
    if (avgPrice > 0 && cfg.take_profit_pct > 0) {
      if (cfg.trailing_tp_enabled) {
        if (profitPct > newPeak) newPeak = profitPct;
        if (newPeak >= cfg.take_profit_pct && (newPeak - profitPct) >= cfg.trailing_tp_deviation) {
          // Sell all
          const sellTotal = positionValue;
          const fee = sellTotal * (FEE_PCT / 100);
          const net = sellTotal - fee;
          const pnl = net - newQuoteSpent;

          await dbInsert('bot_orders', {
            bot_id: botId, user_id: bot.user_id, pair: bot.pair,
            side: 'sell', role: 'dca_take_profit',
            quantity: newBaseBought, price, total: sellTotal, fee, status: 'filled',
          });

          // Credit proceeds back to user balance
          await creditBalance(bot.user_id, net);
          await insertTradeHistory({ userId: bot.user_id, pair: bot.pair, side: 'sell', role: 'DCA Take Profit (Trailing)', amount: net, price, pnl, botName: bot.name });

          newTotalPnl += pnl;
          newTrades += 1;
          invested -= newQuoteSpent;
          newBaseBought = 0; newQuoteSpent = 0; newSafetyCount = 0; newPeak = 0;
          newDealCount += 1;
          await logActivity(botId, 'take_profit_trailing', { price, pnl: +pnl.toFixed(2) });
        }
      } else if (profitPct >= cfg.take_profit_pct) {
        const sellTotal = positionValue;
        const fee = sellTotal * (FEE_PCT / 100);
        const net = sellTotal - fee;
        const pnl = net - newQuoteSpent;

        await dbInsert('bot_orders', {
          bot_id: botId, user_id: bot.user_id, pair: bot.pair,
          side: 'sell', role: 'dca_take_profit',
          quantity: newBaseBought, price, total: sellTotal, fee, status: 'filled',
        });

        await creditBalance(bot.user_id, net);
        await insertTradeHistory({ userId: bot.user_id, pair: bot.pair, side: 'sell', role: 'DCA Take Profit', amount: net, price, pnl, botName: bot.name });

        newTotalPnl += pnl;
        newTrades += 1;
        invested -= newQuoteSpent;
        newBaseBought = 0; newQuoteSpent = 0; newSafetyCount = 0; newPeak = 0;
        newDealCount += 1;
        await logActivity(botId, 'take_profit', { price, pnl: +pnl.toFixed(2) });
      }
    }

    // ---- STOP LOSS ----
    if (cfg.stop_loss_pct && avgPrice > 0 && profitPct <= -cfg.stop_loss_pct) {
      const sellTotal = positionValue;
      const fee = sellTotal * (FEE_PCT / 100);
      const net = sellTotal - fee;
      const pnl = net - newQuoteSpent;

      await dbInsert('bot_orders', {
        bot_id: botId, user_id: bot.user_id, pair: bot.pair,
        side: 'sell', role: 'dca_stop_loss',
        quantity: newBaseBought, price, total: sellTotal, fee, status: 'filled',
      });

      await creditBalance(bot.user_id, net);
      await insertTradeHistory({ userId: bot.user_id, pair: bot.pair, side: 'sell', role: 'DCA Stop Loss', amount: net, price, pnl, botName: bot.name });

      newTotalPnl += pnl;
      newTrades += 1;
      invested -= newQuoteSpent;
      newBaseBought = 0; newQuoteSpent = 0; newSafetyCount = 0; newPeak = 0;
      newDealCount += 1;
      await logActivity(botId, 'stop_loss', { price, pnl: +pnl.toFixed(2) });
    }

    // ---- SAFETY ORDERS (buy dips) ----
    if (cfg.safety_orders_enabled && avgPrice > 0 && newSafetyCount < cfg.max_safety_orders) {
      const triggerPrice = calculateNextSafetyPrice(
        avgPrice, cfg.safety_order_step_pct, cfg.safety_order_step_scale, newSafetyCount + 1,
      );
      if (price <= triggerPrice) {
        const soSize = calculateSafetyOrderSize(cfg.safety_order_size, cfg.safety_order_volume_scale, newSafetyCount);
        const qty = soSize / price;
        const fee = soSize * (FEE_PCT / 100);
        const totalCost = soSize + fee;

        const canAfford = await deductBalance(bot.user_id, totalCost);
        if (canAfford) {
          await dbInsert('bot_orders', {
            bot_id: botId, user_id: bot.user_id, pair: bot.pair,
            side: 'buy', role: 'dca_safety',
            quantity: qty, price, total: soSize, fee, status: 'filled', safety_level: newSafetyCount + 1,
          });
          await insertTradeHistory({ userId: bot.user_id, pair: bot.pair, side: 'buy', role: 'DCA Safety Order', amount: totalCost, price, pnl: 0, botName: bot.name });

          newBaseBought += qty;
          newQuoteSpent += totalCost;
          invested += totalCost;
          newSafetyCount += 1;
          newTrades += 1;
          await logActivity(botId, 'safety_order', { level: newSafetyCount, price, size: soSize });
        }
      }
    }

    // ---- REGULAR DCA BUY ----
    // Only buy if we haven't already filled an order this interval (check last_buy_at)
    const now = Date.now();
    const lastBuy = cfg.last_buy_at ? new Date(cfg.last_buy_at).getTime() : 0;
    const freq = frequencyToMs(cfg.frequency);
    if (now - lastBuy >= freq * 0.95) {
      const amt = cfg.order_amount;
      const qty = amt / price;
      const fee = amt * (FEE_PCT / 100);
      const totalCost = amt + fee;

      // Deduct from user balance
      const canAfford = await deductBalance(bot.user_id, totalCost);
      if (canAfford) {
        await dbInsert('bot_orders', {
          bot_id: botId, user_id: bot.user_id, pair: bot.pair,
          side: 'buy', role: 'dca_base',
          quantity: qty, price, total: amt, fee, status: 'filled',
        });
        await insertTradeHistory({ userId: bot.user_id, pair: bot.pair, side: 'buy', role: 'DCA Buy', amount: totalCost, price, pnl: 0, botName: bot.name });

        newBaseBought += qty;
        newQuoteSpent += totalCost;
        invested += totalCost;
        newTrades += 1;
      }
    }

    // ---- Persist ----
    const currentValue = newBaseBought * price;
    const updCfg: Partial<DCABotConfig> = {
      current_avg_price: calculateDCAAvgPrice(newQuoteSpent, newBaseBought),
      total_base_bought: +newBaseBought.toFixed(8),
      total_quote_spent: +newQuoteSpent.toFixed(8),
      active_safety_count: newSafetyCount,
      peak_profit_pct: +newPeak.toFixed(4),
      deal_count: newDealCount,
      last_buy_at: new Date().toISOString(),
    };
    await dbUpdate('dca_bot_config', cfg.id, updCfg);
    await dbUpdate('trading_bots', botId, {
      invested_amount: +invested.toFixed(8),
      current_value: +currentValue.toFixed(8),
      total_pnl: +newTotalPnl.toFixed(8),
      total_trades: newTrades,
    });

    // Update local state
    set(s => ({
      bots: s.bots.map(b => b.id === botId ? {
        ...b,
        invested_amount: +invested.toFixed(8),
        current_value: +currentValue.toFixed(8),
        total_pnl: +newTotalPnl.toFixed(8),
        total_trades: newTrades,
        dca_config: { ...cfg, ...updCfg } as DCABotConfig,
      } : b),
    }));
  },

  // ============================
  // GRID TICK
  // ============================

  _tickGrid: async (botId) => {
    const bot = get().bots.find(b => b.id === botId);
    if (!bot || bot.status !== 'running' || !bot.grid_config || !bot.grid_levels?.length) return;
    const cfg = bot.grid_config;
    const levels = [...bot.grid_levels];

    const price = await fetchPrice(bot.pair);
    if (!price || price <= 0) return;

    let gridProfit = cfg.grid_profit;
    let totalBaseHeld = cfg.total_base_held;
    let avgBuy = cfg.avg_buy_price;
    let cycles = cfg.completed_cycles;
    let totalTrades = bot.total_trades;
    let invested = bot.invested_amount;

    // ---- Stop triggers ----
    if (cfg.stop_upper_price && price >= cfg.stop_upper_price) {
      get().stopBot(botId);
      await logActivity(botId, 'stop_upper_triggered', { price });
      return;
    }
    if (cfg.stop_lower_price && price <= cfg.stop_lower_price) {
      get().stopBot(botId);
      await logActivity(botId, 'stop_lower_triggered', { price });
      return;
    }

    // ---- Process each level ----
    for (let i = 0; i < levels.length; i++) {
      const lv = levels[i];

      // BUY: price crossed below this level and no buy yet
      if (!lv.buy_filled && price <= lv.price) {
        const qty = cfg.per_grid_amount / lv.price;
        const fee = cfg.per_grid_amount * (FEE_PCT / 100);
        const totalCost = cfg.per_grid_amount + fee;

        const canAfford = await deductBalance(bot.user_id, totalCost);
        if (canAfford) {
          const order = await dbInsert<BotOrder>('bot_orders', {
            bot_id: botId, user_id: bot.user_id, pair: bot.pair,
            side: 'buy', role: 'grid_buy',
            quantity: qty, price: lv.price, total: cfg.per_grid_amount, fee, status: 'filled',
            grid_level: lv.level_index,
          });
          await insertTradeHistory({ userId: bot.user_id, pair: bot.pair, side: 'buy', role: 'Grid Buy', amount: totalCost, price: lv.price, pnl: 0, botName: bot.name });

          lv.buy_filled = true;
          lv.sell_filled = false;
          lv.buy_order_id = order?.id;
          totalBaseHeld += qty;
          invested += totalCost;
          totalTrades += 1;

          await dbUpsertGridLevel({ id: lv.id, buy_filled: true, sell_filled: false, buy_order_id: order?.id });
          await logActivity(botId, 'grid_buy', { level: lv.level_index, price: lv.price, qty });
        }
      }

      // SELL: price crossed above next level and buy was filled
      if (lv.buy_filled && !lv.sell_filled && i < levels.length - 1) {
        const sellLevel = levels[i + 1];
        if (price >= sellLevel.price) {
          const qty = cfg.per_grid_amount / lv.price;
          const sellTotal = qty * sellLevel.price;
          const fee = sellTotal * (FEE_PCT / 100);
          const net = sellTotal - fee;
          const cyclePnl = calculateGridProfitPerCycle(lv.price, sellLevel.price, qty, FEE_PCT);

          const order = await dbInsert<BotOrder>('bot_orders', {
            bot_id: botId, user_id: bot.user_id, pair: bot.pair,
            side: 'sell', role: 'grid_sell',
            quantity: qty, price: sellLevel.price, total: sellTotal, fee, status: 'filled',
            grid_level: lv.level_index,
          });

          // Credit sell proceeds to user balance
          await creditBalance(bot.user_id, net);
          await insertTradeHistory({ userId: bot.user_id, pair: bot.pair, side: 'sell', role: 'Grid Sell', amount: net, price: sellLevel.price, pnl: cyclePnl, botName: bot.name });

          lv.sell_filled = true;
          lv.buy_filled = false;
          lv.sell_order_id = order?.id;
          totalBaseHeld -= qty;
          gridProfit += cyclePnl;
          cycles += 1;
          totalTrades += 1;

          await dbUpsertGridLevel({ id: lv.id, sell_filled: true, buy_filled: false, sell_order_id: order?.id });
          await logActivity(botId, 'grid_sell', { level: lv.level_index, sellPrice: sellLevel.price, pnl: +cyclePnl.toFixed(4) });
        }
      }
    }

    // Float P&L
    const floatPnl = totalBaseHeld > 0 ? (price - avgBuy) * totalBaseHeld : 0;
    const currentValue = gridProfit + (totalBaseHeld * price);
    const totalPnl = gridProfit + floatPnl;

    // Recalculate avg buy
    if (totalBaseHeld > 0) {
      const buyLevels = levels.filter(l => l.buy_filled);
      if (buyLevels.length > 0) {
        avgBuy = buyLevels.reduce((s, l) => s + l.price, 0) / buyLevels.length;
      }
    }

    // Persist
    await dbUpdate('grid_bot_config', cfg.id, {
      grid_profit: +gridProfit.toFixed(8),
      float_pnl: +floatPnl.toFixed(8),
      total_base_held: +totalBaseHeld.toFixed(8),
      avg_buy_price: +avgBuy.toFixed(8),
      completed_cycles: cycles,
    });
    await dbUpdate('trading_bots', botId, {
      invested_amount: +invested.toFixed(8),
      current_value: +currentValue.toFixed(8),
      total_pnl: +totalPnl.toFixed(8),
      total_trades: totalTrades,
    });

    set(s => ({
      bots: s.bots.map(b => b.id === botId ? {
        ...b,
        invested_amount: +invested.toFixed(8),
        current_value: +currentValue.toFixed(8),
        total_pnl: +totalPnl.toFixed(8),
        total_trades: totalTrades,
        grid_config: {
          ...cfg,
          grid_profit: +gridProfit.toFixed(8),
          float_pnl: +floatPnl.toFixed(8),
          total_base_held: +totalBaseHeld.toFixed(8),
          avg_buy_price: +avgBuy.toFixed(8),
          completed_cycles: cycles,
        },
        grid_levels: levels,
      } : b),
    }));
  },
}));
