// Admin Service - Comprehensive admin operations with audit logging
import { supabase } from '@/lib/supabase/client';

// Types
export interface AuditLogEntry {
  id?: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id?: string;
  details?: Record<string, unknown>;
  previous_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: 'user' | 'admin' | 'support' | 'super_admin';
  tier: string;
  is_active: boolean;
  is_frozen?: boolean;
  balance_available: number;
  balance_bonus: number;
  total_deposited: number;
  total_withdrawn: number;
  total_traded: number;
  kyc_status: string;
  registration_status: string;
  created_at: string;
  last_login_at?: string;
}

export interface Trade {
  id: string;
  user_id: string;
  pair: string;
  market_type: string;
  type: string;
  side: string;
  amount: number;
  quantity?: number;
  entry_price: number;
  current_price?: number;
  exit_price?: number;
  leverage: number;
  margin_used?: number;
  stop_loss?: number;
  take_profit?: number;
  pnl: number;
  pnl_percentage: number;
  fees: number;
  status: string;
  close_reason?: string;
  source?: string; // 'live' | 'edu'
  opened_at: string;
  closed_at?: string;
  created_at: string;
  user?: User;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  fee: number;
  balance_before: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  user?: User;
}

export interface EducationalScenario {
  id: string;
  name: string;
  description?: string;
  trend_type: 'steady_rise' | 'steady_fall' | 'range_bound' | 'breakout' | 'fakeout' | 'high_volatility' | 'custom';
  trend_strength: number;
  volatility: number;
  pullback_frequency: number;
  spike_chance: number;
  duration_minutes: number;
  base_price: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Admin Service Class
class AdminService {
  private adminId: string | null = null;

  setAdminId(id: string) {
    this.adminId = id;
  }

  // ============================================================================
  // AUDIT LOGGING
  // ============================================================================
  async logAction(entry: Omit<AuditLogEntry, 'id' | 'created_at'>) {
    try {
      const { error } = await supabase
        .from('admin_logs')
        .insert({
          ...entry,
          admin_id: entry.admin_id || this.adminId,
        });

      if (error) {
        console.error('Failed to log admin action:', error);
      }
    } catch (err) {
      console.error('Audit log error:', err);
    }
  }

  async getAuditLogs(filters?: {
    admin_id?: string;
    action?: string;
    target_type?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.admin_id) {
      query = query.eq('admin_id', filters.admin_id);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.target_type) {
      query = query.eq('target_type', filters.target_type);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;
    return { data, error };
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================
  async getAllUsers(filters?: {
    search?: string;
    status?: string;
    role?: string;
    kyc_status?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.search) {
      query = query.or(`email.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
    }
    if (filters?.status === 'active') {
      query = query.eq('is_active', true);
    } else if (filters?.status === 'inactive') {
      query = query.eq('is_active', false);
    }
    if (filters?.role) {
      query = query.eq('role', filters.role);
    }
    if (filters?.kyc_status) {
      query = query.eq('kyc_status', filters.kyc_status);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    return { data, error };
  }

  async getUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  }

  async updateUser(userId: string, updates: Partial<User>, reason: string) {
    const { data: previousUser } = await this.getUser(userId);

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (!error && this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'user_update',
        target_type: 'user',
        target_id: userId,
        previous_value: previousUser || undefined,
        new_value: data || undefined,
        details: { reason },
      });
    }

    return { data, error };
  }

  async freezeUser(userId: string, reason: string) {
    return this.updateUser(userId, { is_active: false } as Partial<User>, reason);
  }

  async unfreezeUser(userId: string, reason: string) {
    return this.updateUser(userId, { is_active: true } as Partial<User>, reason);
  }

  async setUserRole(userId: string, role: User['role'], reason: string) {
    return this.updateUser(userId, { role } as Partial<User>, reason);
  }

  // ============================================================================
  // BALANCE MANAGEMENT
  // ============================================================================
  async creditBalance(userId: string, amount: number, reason: string) {
    const { data: user } = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    const balanceBefore = user.balance_available;
    const balanceAfter = balanceBefore + amount;

    // Update user balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance_available: balanceAfter })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Create transaction record
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'admin_credit',
        amount: amount,
        fee: 0,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: reason,
        created_by: this.adminId,
      });

    if (txError) throw txError;

    // Log admin action
    if (this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'balance_credit',
        target_type: 'user',
        target_id: userId,
        previous_value: { balance: balanceBefore },
        new_value: { balance: balanceAfter },
        details: { amount, reason },
      });
    }

    return { balanceBefore, balanceAfter };
  }

  async debitBalance(userId: string, amount: number, reason: string) {
    const { data: user } = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    const balanceBefore = user.balance_available;
    const balanceAfter = Math.max(0, balanceBefore - amount);

    // Update user balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance_available: balanceAfter })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Create transaction record
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'admin_debit',
        amount: -amount,
        fee: 0,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: reason,
        created_by: this.adminId,
      });

    if (txError) throw txError;

    // Log admin action
    if (this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'balance_debit',
        target_type: 'user',
        target_id: userId,
        previous_value: { balance: balanceBefore },
        new_value: { balance: balanceAfter },
        details: { amount, reason },
      });
    }

    return { balanceBefore, balanceAfter };
  }

  async getAllTransactions(filters?: {
    user_id?: string;
    type?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        user:users(id, email, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    return { data, error };
  }

  // ============================================================================
  // TRADE MANAGEMENT
  // ============================================================================
  async getAllTrades(filters?: {
    user_id?: string;
    pair?: string;
    market_type?: string;
    status?: string;
    source?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('trades')
      .select(`
        *,
        user:users(id, email, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.pair) {
      query = query.eq('pair', filters.pair);
    }
    if (filters?.market_type) {
      query = query.eq('market_type', filters.market_type);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.source) {
      query = query.eq('source', filters.source);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    return { data, error };
  }

  async getTrade(tradeId: string) {
    const { data, error } = await supabase
      .from('trades')
      .select(`
        *,
        user:users(id, email, first_name, last_name)
      `)
      .eq('id', tradeId)
      .single();
    return { data, error };
  }

  async forceCloseTrade(tradeId: string, exitPrice: number, reason: string) {
    const { data: trade } = await this.getTrade(tradeId);
    if (!trade) throw new Error('Trade not found');
    if (trade.status !== 'open') throw new Error('Trade is not open');

    // Calculate P&L
    const isLong = trade.side === 'long';
    const priceDiff = isLong 
      ? exitPrice - trade.entry_price 
      : trade.entry_price - exitPrice;
    const pnl = priceDiff * (trade.quantity || trade.amount / trade.entry_price) * trade.leverage;
    const pnlPercentage = (pnl / trade.amount) * 100;

    // Update trade
    const { error: tradeError } = await supabase
      .from('trades')
      .update({
        status: 'closed',
        exit_price: exitPrice,
        pnl: pnl,
        pnl_percentage: pnlPercentage,
        close_reason: 'admin',
        closed_at: new Date().toISOString(),
      })
      .eq('id', tradeId);

    if (tradeError) throw tradeError;

    // Update user balance
    const { data: user } = await this.getUser(trade.user_id);
    if (user) {
      const newBalance = user.balance_available + pnl + (trade.margin_used || trade.amount);
      await supabase
        .from('users')
        .update({ balance_available: newBalance })
        .eq('id', trade.user_id);

      // Create transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: trade.user_id,
          type: 'trade_close',
          amount: pnl,
          fee: 0,
          balance_before: user.balance_available,
          balance_after: newBalance,
          reference_type: 'trade',
          reference_id: tradeId,
          description: `Trade closed by admin: ${reason}`,
          created_by: this.adminId,
        });
    }

    // Log admin action
    if (this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'force_close_trade',
        target_type: 'trade',
        target_id: tradeId,
        previous_value: { status: 'open', entry_price: trade.entry_price },
        new_value: { status: 'closed', exit_price: exitPrice, pnl },
        details: { reason },
      });
    }

    return { pnl, exitPrice };
  }

  async cancelTrade(tradeId: string, reason: string) {
    const { data: trade } = await this.getTrade(tradeId);
    if (!trade) throw new Error('Trade not found');
    if (trade.status !== 'pending') throw new Error('Only pending trades can be cancelled');

    const { error } = await supabase
      .from('trades')
      .update({
        status: 'cancelled',
        close_reason: 'admin_cancel',
        closed_at: new Date().toISOString(),
      })
      .eq('id', tradeId);

    if (error) throw error;

    // Log admin action
    if (this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'cancel_trade',
        target_type: 'trade',
        target_id: tradeId,
        previous_value: { status: trade.status },
        new_value: { status: 'cancelled' },
        details: { reason },
      });
    }
  }

  // ============================================================================
  // WITHDRAWAL MANAGEMENT
  // ============================================================================
  async getAllWithdrawals(filters?: {
    user_id?: string;
    status?: string;
    method?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('withdrawals')
      .select(`
        *,
        user:users(id, email, first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.method) {
      query = query.eq('method', filters.method);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    return { data, error };
  }

  async approveWithdrawal(withdrawalId: string, txHash?: string, note?: string) {
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (fetchError || !withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'pending') throw new Error('Withdrawal is not pending');

    const { error } = await supabase
      .from('withdrawals')
      .update({
        status: 'completed',
        tx_hash: txHash,
        admin_note: note,
        processed_by: this.adminId,
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId);

    if (error) throw error;

    // Log admin action
    if (this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'approve_withdrawal',
        target_type: 'withdrawal',
        target_id: withdrawalId,
        previous_value: { status: 'pending' },
        new_value: { status: 'completed', tx_hash: txHash },
        details: { note },
      });
    }
  }

  async rejectWithdrawal(withdrawalId: string, reason: string) {
    const { data: withdrawal, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (fetchError || !withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'pending') throw new Error('Withdrawal is not pending');

    // Refund balance
    const { data: user } = await this.getUser(withdrawal.user_id);
    if (user) {
      await supabase
        .from('users')
        .update({ balance_available: user.balance_available + withdrawal.amount })
        .eq('id', withdrawal.user_id);
    }

    const { error } = await supabase
      .from('withdrawals')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        processed_by: this.adminId,
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId);

    if (error) throw error;

    // Log admin action
    if (this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'reject_withdrawal',
        target_type: 'withdrawal',
        target_id: withdrawalId,
        previous_value: { status: 'pending' },
        new_value: { status: 'rejected' },
        details: { reason },
      });
    }
  }

  // ============================================================================
  // EDUCATIONAL SCENARIOS
  // ============================================================================
  async getEducationalScenarios() {
    const { data, error } = await supabase
      .from('educational_scenarios')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  }

  async createEducationalScenario(scenario: Omit<EducationalScenario, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('educational_scenarios')
      .insert({
        ...scenario,
        created_by: this.adminId,
      })
      .select()
      .single();

    if (!error && this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'create_edu_scenario',
        target_type: 'educational_scenario',
        target_id: data?.id,
        new_value: scenario as unknown as Record<string, unknown>,
      });
    }

    return { data, error };
  }

  async updateEducationalScenario(scenarioId: string, updates: Partial<EducationalScenario>) {
    const { data: previous } = await supabase
      .from('educational_scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single();

    const { data, error } = await supabase
      .from('educational_scenarios')
      .update(updates)
      .eq('id', scenarioId)
      .select()
      .single();

    if (!error && this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'update_edu_scenario',
        target_type: 'educational_scenario',
        target_id: scenarioId,
        previous_value: previous as unknown as Record<string, unknown>,
        new_value: data as unknown as Record<string, unknown>,
      });
    }

    return { data, error };
  }

  async deleteEducationalScenario(scenarioId: string) {
    const { data: previous } = await supabase
      .from('educational_scenarios')
      .select('*')
      .eq('id', scenarioId)
      .single();

    const { error } = await supabase
      .from('educational_scenarios')
      .delete()
      .eq('id', scenarioId);

    if (!error && this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'delete_edu_scenario',
        target_type: 'educational_scenario',
        target_id: scenarioId,
        previous_value: previous as unknown as Record<string, unknown>,
      });
    }

    return { error };
  }

  // ============================================================================
  // MARKET/PAIR MANAGEMENT
  // ============================================================================
  async getCustomPairs() {
    const { data, error } = await supabase
      .from('custom_pairs')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  }

  async createCustomPair(pair: {
    symbol: string;
    name: string;
    category: string;
    base_price: number;
    spread?: number;
    leverage_max?: number;
  }) {
    const { data, error } = await supabase
      .from('custom_pairs')
      .insert({
        ...pair,
        current_price: pair.base_price,
        bid_price: pair.base_price * (1 - (pair.spread || 0.0002) / 2),
        ask_price: pair.base_price * (1 + (pair.spread || 0.0002) / 2),
        created_by: this.adminId,
      })
      .select()
      .single();

    if (!error && this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'create_pair',
        target_type: 'pair',
        target_id: data?.id,
        new_value: pair as unknown as Record<string, unknown>,
      });
    }

    return { data, error };
  }

  async togglePair(pairId: string, enabled: boolean) {
    const { data, error } = await supabase
      .from('custom_pairs')
      .update({ is_enabled: enabled })
      .eq('id', pairId)
      .select()
      .single();

    if (!error && this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: enabled ? 'enable_pair' : 'disable_pair',
        target_type: 'pair',
        target_id: pairId,
        new_value: { is_enabled: enabled },
      });
    }

    return { data, error };
  }

  // ============================================================================
  // PLATFORM SETTINGS
  // ============================================================================
  async getPlatformSettings() {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*');
    return { data, error };
  }

  async updatePlatformSetting(key: string, value: unknown, description?: string) {
    const { data: previous } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('key', key)
      .single();

    const { data, error } = await supabase
      .from('platform_settings')
      .upsert({
        key,
        value: value as object,
        description,
        updated_by: this.adminId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!error && this.adminId) {
      await this.logAction({
        admin_id: this.adminId,
        action: 'update_setting',
        target_type: 'setting',
        target_id: key,
        previous_value: previous?.value as Record<string, unknown>,
        new_value: value as Record<string, unknown>,
      });
    }

    return { data, error };
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================
  async getDashboardStats() {
    const [
      usersResult,
      depositsResult,
      tradesResult,
      withdrawalsResult,
    ] = await Promise.all([
      supabase.from('users').select('id, balance_available, total_deposited, created_at', { count: 'exact' }),
      supabase.from('deposits').select('amount, status', { count: 'exact' }).eq('status', 'confirmed'),
      supabase.from('trades').select('pnl, status, created_at', { count: 'exact' }),
      supabase.from('withdrawals').select('amount, status', { count: 'exact' }).eq('status', 'pending'),
    ]);

    const totalUsers = usersResult.count || 0;
    const totalBalance = usersResult.data?.reduce((sum, u) => sum + (u.balance_available || 0), 0) || 0;
    const totalDeposits = depositsResult.data?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
    const totalTrades = tradesResult.count || 0;
    const pendingWithdrawals = withdrawalsResult.count || 0;
    const pendingWithdrawalsAmount = withdrawalsResult.data?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;

    // New users today
    const today = new Date().toISOString().split('T')[0];
    const newUsersToday = usersResult.data?.filter(u => u.created_at?.startsWith(today)).length || 0;

    // Trades today
    const tradesToday = tradesResult.data?.filter(t => t.created_at?.startsWith(today)).length || 0;

    return {
      totalUsers,
      newUsersToday,
      totalBalance,
      totalDeposits,
      totalTrades,
      tradesToday,
      pendingWithdrawals,
      pendingWithdrawalsAmount,
    };
  }
}

export const adminService = new AdminService();
export default adminService;
