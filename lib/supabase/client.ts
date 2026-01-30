import { createClient } from '@supabase/supabase-js';

// ============================================
// SUPABASE CLIENT CONFIGURATION
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ============================================
// TYPES - DATABASE MODELS
// ============================================

export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  country?: string;
  
  // Trading tier
  tier: 'basic' | 'tier1' | 'tier2' | 'tier3' | 'tier4';
  tier_expires_at?: string;
  
  // Balances
  balance_available: number;
  balance_bonus: number;
  balance_in_trade: number;
  
  // Margin
  margin_balance: number;
  margin_equity: number;
  margin_used: number;
  
  // KYC
  kyc_status: 'pending' | 'verified' | 'rejected';
  
  // Metadata
  is_admin: boolean;
  referral_code?: string;
  created_at: string;
}

export interface TradingTier {
  id: string;
  name: string;
  price: number;
  description: string;
  max_leverage: number;
  spread_discount: number;
  daily_signals: number;
  copy_trading_access: boolean;
  bot_access: boolean;
  priority_support: boolean;
  account_manager: boolean;
  vip_webinars: boolean;
  custom_strategies: boolean;
  max_position_size?: number;
  max_daily_trades?: number;
  features: Record<string, boolean>;
}

export interface CustomPair {
  id: string;
  symbol: string;
  name: string;
  base_currency: string;
  quote_currency: string;
  current_price: number;
  bid_price: number;
  ask_price: number;
  spread: number;
  pip_value: number;
  min_lot_size: number;
  max_leverage: number;
  is_active: boolean;
  trading_enabled: boolean;
  description?: string;
  updated_at: string;
}

export interface CustomCandle {
  id: string;
  pair_id: string;
  timestamp: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_simulated: boolean;
  pattern_hint?: string;
  lesson_note?: string;
  created_by?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'tier_purchase' | 'trade_profit' | 'trade_loss' | 'bonus' | 'referral';
  amount: number;
  currency: string;
  crypto_currency?: string;
  crypto_amount?: number;
  tx_hash?: string;
  wallet_address?: string;
  tier_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  asset_type: 'forex' | 'crypto' | 'stock' | 'custom';
  is_custom_pair: boolean;
  side: 'buy' | 'sell' | 'long' | 'short';
  quantity: number;
  entry_price: number;
  exit_price?: number;
  leverage: number;
  margin_used?: number;
  liquidation_price?: number;
  stop_loss?: number;
  take_profit?: number;
  realized_pnl?: number;
  commission: number;
  status: 'open' | 'closed' | 'liquidated' | 'cancelled';
  opened_at: string;
  closed_at?: string;
}

export interface DepositAddress {
  id: string;
  currency: string;
  network: string;
  address: string;
  qr_code_url?: string;
  is_active: boolean;
}

// ============================================
// CUSTOM PAIRS API - For Admin-Controlled Markets
// ============================================

// The 3 admin-controlled pair symbols
export const ADMIN_CONTROLLED_SYMBOLS = ['NOVA/USD', 'ZAR/XAU', 'EDU/USD'];

export function isAdminControlledPair(symbol: string): boolean {
  return ADMIN_CONTROLLED_SYMBOLS.includes(symbol);
}

// Fetch all custom pairs
export async function getCustomPairs(): Promise<CustomPair[]> {
  const { data, error } = await supabase
    .from('custom_pairs')
    .select('*')
    .eq('is_active', true)
    .order('symbol');
    
  if (error) throw error;
  return data || [];
}

// Get a specific custom pair
export async function getCustomPair(pairId: string): Promise<CustomPair | null> {
  const { data, error } = await supabase
    .from('custom_pairs')
    .select('*')
    .eq('id', pairId)
    .single();
    
  if (error) return null;
  return data;
}

// Update custom pair price (Admin only)
export async function updateCustomPairPrice(
  pairId: string,
  bidPrice: number,
  askPrice: number
): Promise<void> {
  const { error } = await supabase
    .from('custom_pairs')
    .update({
      bid_price: bidPrice,
      ask_price: askPrice,
      current_price: (bidPrice + askPrice) / 2,
    })
    .eq('id', pairId);
    
  if (error) throw error;
}

// ============================================
// CUSTOM CANDLES API
// ============================================

// Fetch candles for a custom pair
export async function getCustomCandles(
  pairId: string,
  timeframe: string = '15m',
  limit: number = 200
): Promise<CustomCandle[]> {
  const { data, error } = await supabase
    .from('custom_candles')
    .select('*')
    .eq('pair_id', pairId)
    .eq('timeframe', timeframe)
    .order('timestamp', { ascending: true })
    .limit(limit);
    
  if (error) throw error;
  return data || [];
}

// Add a new candle (Admin only)
export async function addCustomCandle(candle: Omit<CustomCandle, 'id' | 'created_at'>): Promise<CustomCandle> {
  const { data, error } = await supabase
    .from('custom_candles')
    .insert(candle)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

// Bulk add candles (for pattern generation)
export async function bulkAddCandles(candles: Omit<CustomCandle, 'id' | 'created_at'>[]): Promise<void> {
  const { error } = await supabase
    .from('custom_candles')
    .insert(candles);
    
  if (error) throw error;
}

// Update a candle (Admin only - for editing history)
export async function updateCustomCandle(
  candleId: string,
  updates: Partial<Pick<CustomCandle, 'open' | 'high' | 'low' | 'close' | 'volume' | 'pattern_hint' | 'lesson_note'>>
): Promise<void> {
  const { error } = await supabase
    .from('custom_candles')
    .update(updates)
    .eq('id', candleId);
    
  if (error) throw error;
}

// Delete candles (Admin only)
export async function deleteCustomCandles(pairId: string, from?: string): Promise<void> {
  let query = supabase
    .from('custom_candles')
    .delete()
    .eq('pair_id', pairId);
    
  if (from) {
    query = query.gte('timestamp', from);
  }
  
  const { error } = await query;
  if (error) throw error;
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

export type CandleUpdateCallback = (candle: CustomCandle) => void;
export type PriceUpdateCallback = (pair: CustomPair) => void;

// Subscribe to new candles for a pair
export function subscribeToCandles(
  pairId: string,
  callback: CandleUpdateCallback
): () => void {
  const channel = supabase
    .channel(`candles:${pairId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'custom_candles',
        filter: `pair_id=eq.${pairId}`,
      },
      (payload) => {
        callback(payload.new as CustomCandle);
      }
    )
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to price updates for a pair
export function subscribeToPairPrice(
  pairId: string,
  callback: PriceUpdateCallback
): () => void {
  const channel = supabase
    .channel(`pair:${pairId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'custom_pairs',
        filter: `id=eq.${pairId}`,
      },
      (payload) => {
        callback(payload.new as CustomPair);
      }
    )
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================
// TRADING TIERS API
// ============================================

export async function getTradingTiers(): Promise<TradingTier[]> {
  const { data, error } = await supabase
    .from('trading_tiers')
    .select('*')
    .order('price');
    
  if (error) throw error;
  return data || [];
}

export async function getUserTier(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('tier')
    .eq('id', userId)
    .single();
    
  if (error) return 'basic';
  return data?.tier || 'basic';
}

export async function upgradeTier(userId: string, newTier: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ tier: newTier })
    .eq('id', userId);
    
  if (error) throw error;
}

// ============================================
// DEPOSIT ADDRESSES API
// ============================================

export async function getDepositAddresses(): Promise<DepositAddress[]> {
  const { data, error } = await supabase
    .from('deposit_addresses')
    .select('*')
    .eq('is_active', true);
    
  if (error) throw error;
  return data || [];
}

// ============================================
// TRANSACTIONS API
// ============================================

export async function createDeposit(
  userId: string,
  amount: number,
  cryptoCurrency: string,
  walletAddress: string
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'deposit',
      amount,
      crypto_currency: cryptoCurrency,
      wallet_address: walletAddress,
      status: 'pending',
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function createTierPurchase(
  userId: string,
  tierId: string,
  amount: number
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'tier_purchase',
      amount,
      tier_id: tierId,
      status: 'pending',
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function getUserTransactions(userId: string, limit = 20): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) throw error;
  return data || [];
}

// ============================================
// TRADES API
// ============================================

export async function createTrade(trade: Omit<Trade, 'id' | 'opened_at'>): Promise<Trade> {
  const { data, error } = await supabase
    .from('trades')
    .insert(trade)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function closeTrade(
  tradeId: string,
  exitPrice: number,
  realizedPnl: number
): Promise<void> {
  const { error } = await supabase
    .from('trades')
    .update({
      exit_price: exitPrice,
      realized_pnl: realizedPnl,
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', tradeId);
    
  if (error) throw error;
}

export async function getUserOpenTrades(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false });
    
  if (error) throw error;
  return data || [];
}

export async function getUserTradeHistory(userId: string, limit = 50): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'open')
    .order('closed_at', { ascending: false })
    .limit(limit);
    
  if (error) throw error;
  return data || [];
}
