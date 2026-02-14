/**
 * Admin Markets Service - Supabase Integration
 * 
 * This service connects the admin market control features to Supabase
 * for persistent storage across sessions and devices.
 */

import { supabase, isSupabaseConfigured } from '.client';
import { createServerSupabaseClient } from '.client';

// Helper to check if Supabase is available before making calls
const checkSupabase = () => {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured - admin market features unavailable');
    return false;
  }
  return true;
};

// ============================================
// TYPES
// ============================================

export interface CustomPair {
  id: string;
  symbol: string;
  name: string;
  category: 'forex' | 'crypto' | 'stocks' | 'commodities';
  base_price: number;
  current_price: number;
  spread: number;
  pip_value: number;
  leverage_max: number;
  min_lot: number;
  max_lot: number;
  trading_hours: string;
  is_enabled: boolean;
  description?: string;
  icon?: string;
  created_at: string;
}

export interface PriceOverride {
  id: string;
  pair_symbol: string;
  override_price: number | null;
  price_direction: 'up' | 'down' | 'neutral' | 'volatile';
  volatility_multiplier: number;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export interface TradingSession {
  id: string;
  name: string;
  description?: string;
  pair_symbol: string;
  session_type: 'standard' | 'high_volatility' | 'pump' | 'dump' | 'sideways';
  starts_at: string;
  ends_at: string;
  start_price: number;
  target_price?: number;
  price_path: 'organic' | 'linear' | 'volatile' | 'spike';
  win_rate_override?: number;
  max_profit_per_user?: number;
  max_loss_per_user?: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  actual_end_price?: number;
  participants_count: number;
  total_volume: number;
  created_at: string;
}

export interface MarketPattern {
  id: string;
  name: string;
  description?: string;
  pattern_type: 'bullish' | 'bearish' | 'consolidation' | 'breakout' | 'reversal' | 'custom';
  price_points: { t: number; p: number }[];
  duration_minutes: number;
  volatility: number;
  is_public: boolean;
}

export interface TradeOutcome {
  id: string;
  user_id: string;
  trade_id: string;
  forced_outcome: 'win' | 'lose' | 'breakeven';
  target_pnl?: number;
  target_pnl_percentage?: number;
  close_at?: string;
  close_price_override?: number;
  is_applied: boolean;
  note?: string;
}

// ============================================
// CUSTOM PAIRS
// ============================================

export const customPairsService = {
  // Get all custom pairs
  async getAll(): Promise<CustomPair[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('custom_pairs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching custom pairs:', error);
      return [];
    }
    return data || [];
  },

  // Get enabled pairs only (for users)
  async getEnabled(): Promise<CustomPair[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('custom_pairs')
      .select('*')
      .eq('is_enabled', true)
      .order('symbol');
    
    if (error) {
      console.error('Error fetching enabled pairs:', error);
      return [];
    }
    return data || [];
  },

  // Create new pair
  async create(pair: Omit<CustomPair, 'id' | 'created_at'>): Promise<CustomPair | null> {
    if (!checkSupabase()) return null;
    
    const { data, error } = await supabase
      .from('custom_pairs')
      .insert(pair)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating pair:', error);
      return null;
    }
    return data;
  },

  // Update pair
  async update(id: string, updates: Partial<CustomPair>): Promise<CustomPair | null> {
    if (!checkSupabase()) return null;
    
    const { data, error } = await supabase
      .from('custom_pairs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating pair:', error);
      return null;
    }
    return data;
  },

  // Update current price
  async updatePrice(symbol: string, price: number): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { error } = await supabase
      .from('custom_pairs')
      .update({ current_price: price, updated_at: new Date().toISOString() })
      .eq('symbol', symbol);
    
    if (error) {
      console.error('Error updating price:', error);
      return false;
    }
    return true;
  },

  // Delete pair
  async delete(id: string): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { error } = await supabase
      .from('custom_pairs')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting pair:', error);
      return false;
    }
    return true;
  },

  // Toggle enabled status
  async toggle(id: string): Promise<CustomPair | null> {
    if (!checkSupabase()) return null;
    
    const { data: current } = await supabase
      .from('custom_pairs')
      .select('is_enabled')
      .eq('id', id)
      .single();
    
    const { data, error } = await supabase
      .from('custom_pairs')
      .update({ is_enabled: !current?.is_enabled })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error toggling pair:', error);
      return null;
    }
    return data;
  }
};

// ============================================
// PRICE OVERRIDES
// ============================================

export const priceOverrideService = {
  // Get active override for a pair
  async getActive(pairSymbol: string): Promise<PriceOverride | null> {
    if (!checkSupabase()) return null;
    
    const { data, error } = await supabase
      .from('price_overrides')
      .select('*')
      .eq('pair_symbol', pairSymbol)
      .eq('is_active', true)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching price override:', error);
      return null;
    }
    return data;
  },

  // Get all overrides
  async getAll(): Promise<PriceOverride[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('price_overrides')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching overrides:', error);
      return [];
    }
    return data || [];
  },

  // Set price override (uses DB function)
  async set(pairSymbol: string, price: number, direction: string, adminId: string): Promise<string | null> {
    if (!checkSupabase()) return null;
    
    const { data, error } = await supabase
      .rpc('apply_price_override', {
        p_pair: pairSymbol,
        p_price: price,
        p_direction: direction,
        p_admin_id: adminId
      });
    
    if (error) {
      console.error('Error setting price override:', error);
      return null;
    }
    return data;
  },

  // Deactivate override
  async deactivate(pairSymbol: string): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { error } = await supabase
      .from('price_overrides')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('pair_symbol', pairSymbol)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error deactivating override:', error);
      return false;
    }
    return true;
  },

  // Deactivate all overrides
  async deactivateAll(): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { error } = await supabase
      .from('price_overrides')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true);
    
    if (error) {
      console.error('Error deactivating all overrides:', error);
      return false;
    }
    return true;
  }
};

// ============================================
// TRADING SESSIONS
// ============================================

export const tradingSessionService = {
  // Get all sessions
  async getAll(): Promise<TradingSession[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('trading_sessions')
      .select('*')
      .order('starts_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }
    return data || [];
  },

  // Get active sessions
  async getActive(): Promise<TradingSession[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('status', 'active');
    
    if (error) {
      console.error('Error fetching active sessions:', error);
      return [];
    }
    return data || [];
  },

  // Get upcoming sessions
  async getUpcoming(): Promise<TradingSession[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at');
    
    if (error) {
      console.error('Error fetching upcoming sessions:', error);
      return [];
    }
    return data || [];
  },

  // Create session
  async create(session: Omit<TradingSession, 'id' | 'created_at' | 'participants_count' | 'total_volume'>): Promise<TradingSession | null> {
    if (!checkSupabase()) return null;
    
    const { data, error } = await supabase
      .from('trading_sessions')
      .insert(session)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating session:', error);
      return null;
    }
    return data;
  },

  // Start session
  async start(sessionId: string): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { data, error } = await supabase
      .rpc('start_trading_session', { p_session_id: sessionId });
    
    if (error) {
      console.error('Error starting session:', error);
      return false;
    }
    return data;
  },

  // End session
  async end(sessionId: string, endPrice: number): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { data, error } = await supabase
      .rpc('end_trading_session', { 
        p_session_id: sessionId,
        p_end_price: endPrice
      });
    
    if (error) {
      console.error('Error ending session:', error);
      return false;
    }
    return data;
  },

  // Cancel session
  async cancel(sessionId: string): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { error } = await supabase
      .from('trading_sessions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    
    if (error) {
      console.error('Error cancelling session:', error);
      return false;
    }
    return true;
  },

  // Update session stats
  async updateStats(sessionId: string, participants: number, volume: number): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { error } = await supabase
      .from('trading_sessions')
      .update({ 
        participants_count: participants, 
        total_volume: volume,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    if (error) {
      console.error('Error updating session stats:', error);
      return false;
    }
    return true;
  }
};

// ============================================
// TRADE OUTCOMES (Force Win/Lose)
// ============================================

export const tradeOutcomeService = {
  // Get pending outcomes for a user
  async getForUser(userId: string): Promise<TradeOutcome[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('trade_outcomes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_applied', false);
    
    if (error) {
      console.error('Error fetching user outcomes:', error);
      return [];
    }
    return data || [];
  },

  // Get outcome for specific trade
  async getForTrade(tradeId: string): Promise<TradeOutcome | null> {
    if (!checkSupabase()) return null;
    
    const { data, error } = await supabase
      .from('trade_outcomes')
      .select('*')
      .eq('trade_id', tradeId)
      .eq('is_applied', false)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching trade outcome:', error);
      return null;
    }
    return data;
  },

  // Force trade outcome
  async force(tradeId: string, outcome: 'win' | 'lose' | 'breakeven', targetPnl: number, adminId: string, note?: string): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { data, error } = await supabase
      .rpc('force_trade_outcome', {
        p_trade_id: tradeId,
        p_outcome: outcome,
        p_target_pnl: targetPnl,
        p_admin_id: adminId,
        p_note: note
      });
    
    if (error) {
      console.error('Error forcing trade outcome:', error);
      return false;
    }
    return data;
  },

  // Mark outcome as applied
  async markApplied(outcomeId: string): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { error } = await supabase
      .from('trade_outcomes')
      .update({ is_applied: true, applied_at: new Date().toISOString() })
      .eq('id', outcomeId);
    
    if (error) {
      console.error('Error marking outcome as applied:', error);
      return false;
    }
    return true;
  }
};

// ============================================
// MARKET PATTERNS
// ============================================

export const marketPatternService = {
  // Get all patterns
  async getAll(): Promise<MarketPattern[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('market_patterns')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching patterns:', error);
      return [];
    }
    return data || [];
  },

  // Get public patterns
  async getPublic(): Promise<MarketPattern[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('market_patterns')
      .select('*')
      .eq('is_public', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching public patterns:', error);
      return [];
    }
    return data || [];
  },

  // Create pattern
  async create(pattern: Omit<MarketPattern, 'id'>): Promise<MarketPattern | null> {
    if (!checkSupabase()) return null;
    
    const { data, error } = await supabase
      .from('market_patterns')
      .insert(pattern)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating pattern:', error);
      return null;
    }
    return data;
  },

  // Delete pattern
  async delete(id: string): Promise<boolean> {
    if (!checkSupabase()) return false;
    
    const { error } = await supabase
      .from('market_patterns')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting pattern:', error);
      return false;
    }
    return true;
  }
};

// ============================================
// ADMIN LOGS
// ============================================

export const adminLogService = {
  // Log an action
  async log(adminId: string, action: string, targetType?: string, targetId?: string, details?: any): Promise<void> {
    if (!checkSupabase()) return;
    
    const { error } = await supabase
      .from('admin_logs')
      .insert({
        admin_id: adminId,
        action,
        target_type: targetType,
        target_id: targetId,
        details
      });
    
    if (error) console.error('Failed to log admin action:', error);
  },

  // Get recent logs
  async getRecent(limit: number = 50): Promise<any[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('admin_logs')
      .select('*, users:admin_id(email)')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching logs:', error);
      return [];
    }
    return data || [];
  },

  // Get logs for specific admin
  async getForAdmin(adminId: string, limit: number = 50): Promise<any[]> {
    if (!checkSupabase()) return [];
    
    const { data, error } = await supabase
      .from('admin_logs')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching admin logs:', error);
      return [];
    }
    return data || [];
  }
};

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

export const marketSubscriptions = {
  // Subscribe to price changes
  onPriceChange(callback: (payload: any) => void) {
    if (!checkSupabase()) {
      return { unsubscribe: () => {} };
    }
    
    return supabase
      .channel('price-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'custom_pairs' },
        callback
      )
      .subscribe();
  },

  // Subscribe to active overrides
  onOverrideChange(callback: (payload: any) => void) {
    if (!checkSupabase()) {
      return { unsubscribe: () => {} };
    }
    
    return supabase
      .channel('override-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'price_overrides' },
        callback
      )
      .subscribe();
  },

  // Subscribe to session changes
  onSessionChange(callback: (payload: any) => void) {
    if (!checkSupabase()) {
      return { unsubscribe: () => {} };
    }
    
    return supabase
      .channel('session-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trading_sessions' },
        callback
      )
      .subscribe();
  }
};

// ============================================
// HELPER: Check if pair has active override
// ============================================

export async function getEffectivePrice(pairSymbol: string, marketPrice: number): Promise<number> {
  if (!checkSupabase()) return marketPrice;
  
  const override = await priceOverrideService.getActive(pairSymbol);
  
  if (override?.is_active && override.override_price) {
    return override.override_price;
  }
  
  return marketPrice;
}

// ============================================
// HELPER: Apply volatility to price
// ============================================

export function applyVolatility(price: number, direction: string, multiplier: number = 1): number {
  const baseVolatility = 0.001; // 0.1% base movement
  const movement = price * baseVolatility * multiplier;
  
  switch (direction) {
    case 'up':
      return price + Math.random() * movement;
    case 'down':
      return price - Math.random() * movement;
    case 'volatile':
      return price + (Math.random() - 0.5) * movement * 3;
    default:
      return price + (Math.random() - 0.5) * movement;
  }
}
