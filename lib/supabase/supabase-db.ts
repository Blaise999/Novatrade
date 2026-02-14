/**
 * Supabase Database Service
 *
 * Handles ALL data operations - deposits, trades, balances, etc.
 * This replaces localStorage completely.
 */

import { supabase, isSupabaseConfigured } from '.client';

// ============================================
// TYPES
// ============================================

export interface Deposit {
  id: string;
  userId: string;
  userEmail?: string;
  orderId: string;
  amount: number;
  method: 'crypto' | 'bank' | 'processor';
  methodId?: string;
  methodName: string;
  transactionRef?: string;
  proofUrl?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  processedBy?: string;
  processedAt?: string;
  note?: string;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  fee: number;
  netAmount: number;
  method: string;
  walletAddress?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  processedBy?: string;
  processedAt?: string;
  txHash?: string;
  note?: string;
  createdAt: string;
}

export interface Trade {
  id: string;
  userId: string;
  pair: string;
  marketType: 'forex' | 'crypto' | 'stocks' | 'commodities';
  type: 'buy' | 'sell';
  side: 'long' | 'short';
  amount: number;
  quantity?: number;
  entryPrice: number;
  currentPrice?: number;
  exitPrice?: number;
  leverage: number;
  marginUsed?: number;
  status: 'open' | 'closed' | 'liquidated' | 'pending';
  pnl?: number;
  pnlPercentage?: number;
  stopLoss?: number;
  takeProfit?: number;
  closedAt?: string;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  type: 'crypto' | 'bank' | 'processor';
  name: string;
  symbol?: string;
  network?: string;
  address?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  country?: string;
  currency?: string;
  icon?: string;
  fee?: string;
  instructions?: string;
  minDeposit: number;
  confirmations?: number;
  enabled: boolean;
}

// ============================================
// BALANCE SERVICE
// ============================================

export const balanceService = {
  async getBalance(userId: string): Promise<{ available: number; bonus: number } | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('users')
      .select('balance_available, balance_bonus')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      available: parseFloat(data.balance_available) || 0,
      bonus: parseFloat(data.balance_bonus) || 0,
    };
  },

  async addBalance(userId: string, amount: number, adminId: string, reason?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase.rpc('update_user_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_type: 'credit',
      p_description: reason || 'Admin credit',
      p_admin_id: adminId,
    });

    return !error;
  },

  async deductBalance(userId: string, amount: number, reason?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase.rpc('update_user_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_type: 'debit',
      p_description: reason || 'Deduction',
    });

    return !error;
  },

  async updateTier(userId: string, tier: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('users')
      .update({ tier, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return !error;
  },
};

// ============================================
// DEPOSIT SERVICE
// ============================================

export const depositService = {
  async create(deposit: {
    userId: string;
    userEmail: string;
    amount: number;
    method: 'crypto' | 'bank' | 'processor';
    methodId?: string;
    methodName: string;
    transactionRef?: string;
    proofUrl?: string;
  }): Promise<Deposit | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('deposits')
      .insert({
        user_id: deposit.userId,
        order_id: `DEP-${Date.now()}`,
        amount: deposit.amount,
        method: deposit.method,
        method_id: deposit.methodId,
        method_name: deposit.methodName,
        transaction_ref: deposit.transactionRef,
        proof_url: deposit.proofUrl,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: data.user_id,
      orderId: data.order_id,
      amount: parseFloat(data.amount),
      method: data.method,
      methodId: data.method_id,
      methodName: data.method_name,
      transactionRef: data.transaction_ref,
      proofUrl: data.proof_url,
      status: data.status,
      createdAt: data.created_at,
    };
  },

  async getByUser(userId: string): Promise<Deposit[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      orderId: d.order_id,
      amount: parseFloat(d.amount),
      method: d.method,
      methodId: d.method_id,
      methodName: d.method_name,
      transactionRef: d.transaction_ref,
      proofUrl: d.proof_url,
      status: d.status,
      processedBy: d.processed_by,
      processedAt: d.processed_at,
      note: d.note,
      createdAt: d.created_at,
    }));
  },

  async getPending(): Promise<Deposit[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('deposits')
      .select('*, users!inner(email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      userEmail: d.users?.email,
      orderId: d.order_id,
      amount: parseFloat(d.amount),
      method: d.method,
      methodId: d.method_id,
      methodName: d.method_name,
      transactionRef: d.transaction_ref,
      proofUrl: d.proof_url,
      status: d.status,
      createdAt: d.created_at,
    }));
  },

  async confirm(depositId: string, adminId: string, note?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { data, error } = await supabase.rpc('confirm_deposit', {
      p_deposit_id: depositId,
      p_admin_id: adminId,
      p_note: note,
    });

    return !error && !!data;
  },

  async reject(depositId: string, adminId: string, note?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('deposits')
      .update({
        status: 'rejected',
        processed_by: adminId,
        processed_at: new Date().toISOString(),
        note,
      })
      .eq('id', depositId);

    return !error;
  },

  async getAll(limit = 100): Promise<Deposit[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('deposits')
      .select('*, users!inner(email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      userEmail: d.users?.email,
      orderId: d.order_id,
      amount: parseFloat(d.amount),
      method: d.method,
      methodId: d.method_id,
      methodName: d.method_name,
      transactionRef: d.transaction_ref,
      proofUrl: d.proof_url,
      status: d.status,
      processedBy: d.processed_by,
      processedAt: d.processed_at,
      note: d.note,
      createdAt: d.created_at,
    }));
  },
};

// ============================================
// WITHDRAWAL SERVICE
// ============================================

export const withdrawalService = {
  async create(withdrawal: {
    userId: string;
    amount: number;
    fee?: number;
    method: string;
    walletAddress?: string;
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
  }): Promise<Withdrawal | null> {
    if (!isSupabaseConfigured()) return null;

    const fee = withdrawal.fee || 0;
    const netAmount = withdrawal.amount - fee;

    const balance = await balanceService.getBalance(withdrawal.userId);
    if (!balance || balance.available < withdrawal.amount) return null;

    const deducted = await balanceService.deductBalance(withdrawal.userId, withdrawal.amount, 'Withdrawal request');
    if (!deducted) return null;

    const { data, error } = await supabase
      .from('withdrawals')
      .insert({
        user_id: withdrawal.userId,
        amount: withdrawal.amount,
        fee,
        net_amount: netAmount,
        method: withdrawal.method,
        wallet_address: withdrawal.walletAddress,
        bank_name: withdrawal.bankName,
        account_name: withdrawal.accountName,
        account_number: withdrawal.accountNumber,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !data) {
      await balanceService.addBalance(withdrawal.userId, withdrawal.amount, 'system', 'Withdrawal failed refund');
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      amount: parseFloat(data.amount),
      fee: parseFloat(data.fee),
      netAmount: parseFloat(data.net_amount),
      method: data.method,
      walletAddress: data.wallet_address,
      bankName: data.bank_name,
      accountName: data.account_name,
      accountNumber: data.account_number,
      status: data.status,
      createdAt: data.created_at,
    };
  },

  async getByUser(userId: string): Promise<Withdrawal[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((w: any) => ({
      id: w.id,
      userId: w.user_id,
      amount: parseFloat(w.amount),
      fee: parseFloat(w.fee),
      netAmount: parseFloat(w.net_amount),
      method: w.method,
      walletAddress: w.wallet_address,
      bankName: w.bank_name,
      accountName: w.account_name,
      accountNumber: w.account_number,
      status: w.status,
      processedBy: w.processed_by,
      processedAt: w.processed_at,
      txHash: w.tx_hash,
      note: w.note,
      createdAt: w.created_at,
    }));
  },

  async process(withdrawalId: string, adminId: string, txHash?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('withdrawals')
      .update({
        status: 'completed',
        processed_by: adminId,
        processed_at: new Date().toISOString(),
        tx_hash: txHash,
      })
      .eq('id', withdrawalId);

    return !error;
  },

  async reject(withdrawalId: string, adminId: string, note?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { data: withdrawal } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .maybeSingle();

    if (!withdrawal) return false;

    await balanceService.addBalance(withdrawal.user_id, parseFloat(withdrawal.amount), adminId, 'Withdrawal rejected - refund');

    const { error } = await supabase
      .from('withdrawals')
      .update({
        status: 'rejected',
        processed_by: adminId,
        processed_at: new Date().toISOString(),
        note,
      })
      .eq('id', withdrawalId);

    return !error;
  },
};

// ============================================
// TRADE SERVICE
// ============================================

export const tradeService = {
  async openTrade(trade: {
    userId: string;
    pair: string;
    marketType: 'forex' | 'crypto' | 'stocks' | 'commodities';
    type: 'buy' | 'sell';
    side: 'long' | 'short';
    amount: number;
    entryPrice: number;
    leverage?: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<Trade | null> {
    if (!isSupabaseConfigured()) return null;

    const leverage = trade.leverage || 1;
    const marginUsed = trade.amount / leverage;

    const balance = await balanceService.getBalance(trade.userId);
    if (!balance || balance.available < marginUsed) return null;

    const deducted = await balanceService.deductBalance(trade.userId, marginUsed, `Open trade: ${trade.pair}`);
    if (!deducted) return null;

    const { data, error } = await supabase
      .from('trades')
      .insert({
        user_id: trade.userId,
        pair: trade.pair,
        market_type: trade.marketType,
        type: trade.type,
        side: trade.side,
        amount: trade.amount,
        entry_price: trade.entryPrice,
        current_price: trade.entryPrice,
        leverage,
        margin_used: marginUsed,
        stop_loss: trade.stopLoss,
        take_profit: trade.takeProfit,
        status: 'open',
        pnl: 0,
      })
      .select()
      .single();

    if (error || !data) {
      await balanceService.addBalance(trade.userId, marginUsed, 'system', 'Trade failed refund');
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      pair: data.pair,
      marketType: data.market_type,
      type: data.type,
      side: data.side,
      amount: parseFloat(data.amount),
      entryPrice: parseFloat(data.entry_price),
      currentPrice: parseFloat(data.current_price),
      leverage: data.leverage,
      marginUsed: parseFloat(data.margin_used),
      stopLoss: data.stop_loss ? parseFloat(data.stop_loss) : undefined,
      takeProfit: data.take_profit ? parseFloat(data.take_profit) : undefined,
      status: data.status,
      pnl: parseFloat(data.pnl) || 0,
      createdAt: data.created_at,
    };
  },

  async closeTrade(tradeId: string, exitPrice: number, pnl: number): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { data: trade } = await supabase.from('trades').select('*').eq('id', tradeId).maybeSingle();
    if (!trade || trade.status !== 'open') return false;

    const returnAmount = parseFloat(trade.margin_used) + pnl;
    if (returnAmount > 0) {
      await balanceService.addBalance(
        trade.user_id,
        returnAmount,
        'system',
        `Close trade: ${trade.pair} P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`
      );
    }

    const { error } = await supabase
      .from('trades')
      .update({
        status: 'closed',
        exit_price: exitPrice,
        pnl,
        pnl_percentage: (pnl / parseFloat(trade.margin_used)) * 100,
        closed_at: new Date().toISOString(),
      })
      .eq('id', tradeId);

    return !error;
  },

  async getOpenTrades(userId: string): Promise<Trade[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((t: any) => ({
      id: t.id,
      userId: t.user_id,
      pair: t.pair,
      marketType: t.market_type,
      type: t.type,
      side: t.side,
      amount: parseFloat(t.amount),
      entryPrice: parseFloat(t.entry_price),
      currentPrice: t.current_price ? parseFloat(t.current_price) : undefined,
      leverage: t.leverage,
      marginUsed: t.margin_used ? parseFloat(t.margin_used) : undefined,
      stopLoss: t.stop_loss ? parseFloat(t.stop_loss) : undefined,
      takeProfit: t.take_profit ? parseFloat(t.take_profit) : undefined,
      status: t.status,
      pnl: t.pnl ? parseFloat(t.pnl) : undefined,
      pnlPercentage: t.pnl_percentage ? parseFloat(t.pnl_percentage) : undefined,
      createdAt: t.created_at,
    }));
  },

  async getTradeHistory(userId: string, limit = 50): Promise<Trade[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['closed', 'liquidated'])
      .order('closed_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((t: any) => ({
      id: t.id,
      userId: t.user_id,
      pair: t.pair,
      marketType: t.market_type,
      type: t.type,
      side: t.side,
      amount: parseFloat(t.amount),
      entryPrice: parseFloat(t.entry_price),
      exitPrice: t.exit_price ? parseFloat(t.exit_price) : undefined,
      leverage: t.leverage,
      status: t.status,
      pnl: t.pnl ? parseFloat(t.pnl) : undefined,
      pnlPercentage: t.pnl_percentage ? parseFloat(t.pnl_percentage) : undefined,
      closedAt: t.closed_at,
      createdAt: t.created_at,
    }));
  },

  async updateTradePrice(tradeId: string, currentPrice: number, pnl: number): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('trades')
      .update({ current_price: currentPrice, pnl })
      .eq('id', tradeId)
      .eq('status', 'open');

    return !error;
  },
};

// ============================================
// PAYMENT METHODS SERVICE
// ============================================

export const paymentMethodService = {
  async getEnabled(): Promise<PaymentMethod[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('enabled', true)
      .order('display_order');

    if (error || !data) return [];

    return data.map((p: any) => ({
      id: p.id,
      type: p.type,
      name: p.name,
      symbol: p.symbol,
      network: p.network,
      address: p.address,
      accountName: p.account_name,
      accountNumber: p.account_number,
      routingNumber: p.routing_number,
      swiftCode: p.swift_code,
      iban: p.iban,
      country: p.country,
      currency: p.currency,
      icon: p.icon,
      fee: p.fee,
      instructions: p.instructions,
      minDeposit: parseFloat(p.min_deposit),
      confirmations: p.confirmations,
      enabled: p.enabled,
    }));
  },

  async getAll(): Promise<PaymentMethod[]> {
    if (!isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('type', { ascending: true })
      .order('display_order');

    if (error || !data) return [];

    return data.map((p: any) => ({
      id: p.id,
      type: p.type,
      name: p.name,
      symbol: p.symbol,
      network: p.network,
      address: p.address,
      accountName: p.account_name,
      accountNumber: p.account_number,
      routingNumber: p.routing_number,
      swiftCode: p.swift_code,
      iban: p.iban,
      country: p.country,
      currency: p.currency,
      icon: p.icon,
      fee: p.fee,
      instructions: p.instructions,
      minDeposit: parseFloat(p.min_deposit),
      confirmations: p.confirmations,
      enabled: p.enabled,
    }));
  },

  async create(method: Omit<PaymentMethod, 'id'>): Promise<PaymentMethod | null> {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        type: method.type,
        name: method.name,
        symbol: method.symbol,
        network: method.network,
        address: method.address,
        account_name: method.accountName,
        account_number: method.accountNumber,
        routing_number: method.routingNumber,
        swift_code: method.swiftCode,
        iban: method.iban,
        country: method.country,
        currency: method.currency,
        icon: method.icon,
        fee: method.fee,
        instructions: method.instructions,
        min_deposit: method.minDeposit,
        confirmations: method.confirmations,
        enabled: method.enabled,
      })
      .select()
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      type: data.type,
      name: data.name,
      symbol: data.symbol,
      network: data.network,
      address: data.address,
      accountName: data.account_name,
      accountNumber: data.account_number,
      routingNumber: data.routing_number,
      swiftCode: data.swift_code,
      iban: data.iban,
      country: data.country,
      currency: data.currency,
      icon: data.icon,
      fee: data.fee,
      instructions: data.instructions,
      minDeposit: parseFloat(data.min_deposit),
      confirmations: data.confirmations,
      enabled: data.enabled,
    };
  },

  async update(id: string, updates: Partial<PaymentMethod>): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('payment_methods')
      .update({
        name: updates.name,
        symbol: updates.symbol,
        network: updates.network,
        address: updates.address,
        account_name: updates.accountName,
        account_number: updates.accountNumber,
        routing_number: updates.routingNumber,
        swift_code: updates.swiftCode,
        iban: updates.iban,
        country: updates.country,
        currency: updates.currency,
        icon: updates.icon,
        fee: updates.fee,
        instructions: updates.instructions,
        min_deposit: updates.minDeposit,
        confirmations: updates.confirmations,
        enabled: updates.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return !error;
  },

  async toggle(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { data: current } = await supabase.from('payment_methods').select('enabled').eq('id', id).maybeSingle();
    if (!current) return false;

    const { error } = await supabase.from('payment_methods').update({ enabled: !current.enabled }).eq('id', id);
    return !error;
  },

  async delete(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
    return !error;
  },
};

// ============================================
// USER SERVICE (Admin)
// ============================================

export const userService = {
  async getAll(): Promise<any[]> {
    if (!isSupabaseConfigured()) return [];

    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  async getById(userId: string): Promise<any | null> {
    if (!isSupabaseConfigured()) return null;

    const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    return data || null;
  },

  async update(userId: string, updates: any): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return !error;
  },

  async disable(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase.from('users').update({ is_active: false }).eq('id', userId);
    return !error;
  },

  async enable(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase.from('users').update({ is_active: true }).eq('id', userId);
    return !error;
  },
};

// ============================================
// PLATFORM SETTINGS SERVICE
// ============================================

export const settingsService = {
  async get(key: string): Promise<any> {
    if (!isSupabaseConfigured()) return null;

    const { data } = await supabase.from('platform_settings').select('value').eq('key', key).maybeSingle();
    return data?.value ?? null;
  },

  async set(key: string, value: any): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    const { error } = await supabase
      .from('platform_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });

    return !error;
  },

  async getAll(): Promise<Record<string, any>> {
    if (!isSupabaseConfigured()) return {};

    const { data } = await supabase.from('platform_settings').select('key, value');
    if (!data) return {};

    return data.reduce((acc: Record<string, any>, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  },
};
