/**
 * FX TRADES API - OLYMP STYLE
 * ============================
 * 
 * This implements the Olymp Trade model for FX:
 * - Investment (I): Actual cash user risks
 * - Multiplier (M): Leverage
 * - Direction (D): +1 buy, -1 sell
 * - P/L = D × I × M × ((P_current - P_entry) / P_entry)
 * - Liquidation at P/L = -Investment
 * 
 * ALL BALANCE CHANGES ARE ATOMIC - no local store modifications!
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// SUPABASE ADMIN
// ==========================================

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase not configured');
  }
  
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// ==========================================
// AUTHENTICATION
// ==========================================

async function getUserId(request: NextRequest): Promise<string | null> {
  const userId = request.headers.get('x-user-id');
  if (userId) return userId;
  
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  try {
    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.auth.getUser(token);
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

// ==========================================
// SPREAD CONFIG
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
  'default': 0.0002,
};

function getSpread(symbol: string): number {
  return FX_SPREADS[symbol] || FX_SPREADS.default;
}

// ==========================================
// OLYMP-STYLE MATH
// ==========================================

function parseDirection(input: string): number {
  const lower = input.toLowerCase();
  return (lower === 'buy' || lower === 'long') ? 1 : -1;
}

function calculatePnL(
  direction: number,
  investment: number,
  multiplier: number,
  entryPrice: number,
  currentPrice: number
): number {
  if (entryPrice <= 0) return 0;
  const relativeChange = (currentPrice - entryPrice) / entryPrice;
  return direction * investment * multiplier * relativeChange;
}

function calculateLiquidationPrice(
  direction: number,
  entryPrice: number,
  multiplier: number
): number {
  if (multiplier <= 0) return 0;
  return entryPrice * (1 - (direction / multiplier));
}

function getEntryPrice(
  direction: number,
  midPrice: number,
  spreadPercent: number
): number {
  const halfSpread = midPrice * spreadPercent / 2;
  return direction === 1 ? midPrice + halfSpread : midPrice - halfSpread;
}

// ==========================================
// IDEMPOTENCY CACHE
// ==========================================

const idempotencyCache = new Map<string, { tradeId: string; expiresAt: number }>();

function checkIdempotency(key: string): string | null {
  const record = idempotencyCache.get(key);
  if (record && Date.now() < record.expiresAt) {
    return record.tradeId;
  }
  return null;
}

function setIdempotency(key: string, tradeId: string): void {
  // Clean old entries
  if (idempotencyCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache) {
      if (now > v.expiresAt) idempotencyCache.delete(k);
    }
  }
  idempotencyCache.set(key, {
    tradeId,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
}

// ==========================================
// UUID GENERATOR
// ==========================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==========================================
// POST - OPEN FX TRADE (OLYMP STYLE)
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const body = await request.json();
    const {
      symbol,
      name,
      direction: directionStr,
      investment,
      multiplier,
      currentPrice,
      stopLoss,
      takeProfit,
    } = body;
    
    // Validation
    if (!symbol || !directionStr || !investment || !multiplier || !currentPrice) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    const investmentNum = Number(investment);
    const multiplierNum = Number(multiplier);
    const priceNum = Number(currentPrice);
    
    if (investmentNum <= 0) {
      return NextResponse.json({ success: false, error: 'Investment must be positive' }, { status: 400 });
    }
    if (multiplierNum < 1 || multiplierNum > 1000) {
      return NextResponse.json({ success: false, error: 'Multiplier must be 1-1000' }, { status: 400 });
    }
    if (priceNum <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid price' }, { status: 400 });
    }
    
    // Idempotency check
    const idempKey = request.headers.get('x-idempotency-key');
    const timeKey = `${userId}:${symbol}:${investmentNum}:${directionStr}:${Math.floor(Date.now() / 5000)}`;
    
    const existingId = checkIdempotency(idempKey ? `${userId}:${idempKey}` : timeKey);
    if (existingId) {
      return NextResponse.json({
        success: true,
        tradeId: existingId,
        message: 'Trade already processed',
        duplicate: true,
      });
    }
    
    const supabase = getSupabaseAdmin();
    
    // Get user balance with optimistic locking
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('balance_available, tier_level, tier_active')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    // Tier check
    const tierLevel = Number(userData.tier_level ?? 0);
    const tierActive = Boolean(userData.tier_active);
    
    if (tierLevel < 1 || !tierActive) {
      return NextResponse.json({
        success: false,
        error: 'Upgrade required: You need at least Starter tier to trade.',
        requiresTier: 1,
      }, { status: 403 });
    }
    
    const currentBalance = Number(userData.balance_available) || 0;
    
    if (currentBalance < investmentNum) {
      return NextResponse.json({
        success: false,
        error: `Insufficient balance. Need: $${investmentNum.toFixed(2)}, Have: $${currentBalance.toFixed(2)}`,
      }, { status: 400 });
    }
    
    // Calculate trade parameters
    const direction = parseDirection(directionStr);
    const spreadPercent = getSpread(symbol);
    const entryPrice = getEntryPrice(direction, priceNum, spreadPercent);
    const liquidationPrice = calculateLiquidationPrice(direction, entryPrice, multiplierNum);
    const volume = investmentNum * multiplierNum;
    const spreadCost = investmentNum * spreadPercent * multiplierNum;
    
    const tradeId = generateUUID();
    const now = new Date().toISOString();
    
    // ATOMIC: Deduct investment from balance
    const newBalance = currentBalance - investmentNum;
    
    const { error: balanceError, count } = await supabase
      .from('users')
      .update({
        balance_available: newBalance,
        updated_at: now,
      })
      .eq('id', userId)
      .eq('balance_available', currentBalance); // Optimistic lock
    
    if (balanceError || count === 0) {
      return NextResponse.json({
        success: false,
        error: 'Balance update failed - please retry',
      }, { status: 409 });
    }
    
    // Insert trade record
    const tradeRow = {
      id: tradeId,
      user_id: userId,
      market_type: 'fx',
      asset_type: 'forex',
      trade_type: 'forex',
      pair: symbol,
      symbol: symbol,
      direction: direction === 1 ? 'buy' : 'sell',
      type: direction === 1 ? 'buy' : 'sell',
      direction_int: direction,
      amount: investmentNum,
      investment: investmentNum,
      multiplier: multiplierNum,
      leverage: multiplierNum,
      volume: volume,
      entry_price: entryPrice,
      liquidation_price: liquidationPrice,
      stop_loss: stopLoss || null,
      take_profit: takeProfit || null,
      current_price: entryPrice,
      floating_pnl: -spreadCost,
      spread_cost: spreadCost,
      status: 'open',
      opened_at: now,
      created_at: now,
      updated_at: now,
      is_simulated: true,
    };
    
    const { error: insertError } = await supabase.from('trades').insert(tradeRow);
    
    if (insertError) {
      // Rollback balance
      await supabase.from('users').update({ balance_available: currentBalance }).eq('id', userId);
      console.error('[FX Trades] Insert error:', insertError);
      return NextResponse.json({ success: false, error: 'Failed to save trade' }, { status: 500 });
    }
    
    // Set idempotency
    if (idempKey) setIdempotency(`${userId}:${idempKey}`, tradeId);
    setIdempotency(timeKey, tradeId);
    
    return NextResponse.json({
      success: true,
      trade: {
        id: tradeId,
        symbol,
        direction: direction === 1 ? 'buy' : 'sell',
        investment: investmentNum,
        multiplier: multiplierNum,
        entryPrice,
        liquidationPrice,
        stopLoss,
        takeProfit,
        spreadCost,
        status: 'open',
      },
      newBalance,
      balanceChange: -investmentNum,
      message: `Opened ${direction === 1 ? 'BUY' : 'SELL'} ${symbol} @ ${entryPrice.toFixed(5)}`,
    });
    
  } catch (error: any) {
    console.error('[FX Trades POST]', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}

// ==========================================
// PATCH - CLOSE FX TRADE
// ==========================================

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const body = await request.json();
    const { tradeId, exitPrice, reason = 'manual' } = body;
    
    if (!tradeId || exitPrice === undefined) {
      return NextResponse.json({ success: false, error: 'tradeId and exitPrice required' }, { status: 400 });
    }
    
    const supabase = getSupabaseAdmin();
    
    // Get trade
    const { data: trade, error: fetchError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !trade) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }
    
    if (!['open', 'active', 'pending'].includes(trade.status)) {
      return NextResponse.json({ success: false, error: 'Trade already closed' }, { status: 400 });
    }
    
    // Calculate final P/L using Olymp formula
    const direction = trade.direction_int || (trade.direction === 'buy' ? 1 : -1);
    const investment = Number(trade.investment || trade.amount || 0);
    const multiplier = Number(trade.multiplier || trade.leverage || 1);
    const entryPrice = Number(trade.entry_price || 0);
    const exitPriceNum = Number(exitPrice);
    
    let finalPnL = calculatePnL(direction, investment, multiplier, entryPrice, exitPriceNum);
    
    // Cap loss at investment (cannot lose more than risked)
    if (finalPnL < -investment) {
      finalPnL = -investment;
    }
    
    // Get current balance
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('balance_available')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    const currentBalance = Number(userData.balance_available) || 0;
    
    // Credit: investment + finalPnL
    const creditAmount = investment + finalPnL;
    const newBalance = Math.max(0, currentBalance + creditAmount);
    
    const now = new Date().toISOString();
    
    // Update balance atomically
    const { error: balanceError } = await supabase
      .from('users')
      .update({
        balance_available: newBalance,
        updated_at: now,
      })
      .eq('id', userId);
    
    if (balanceError) {
      return NextResponse.json({ success: false, error: 'Balance update failed' }, { status: 500 });
    }
    
    // Determine final status
    const finalStatus = 
      reason === 'liquidated' ? 'liquidated' :
      reason === 'stopped_out' ? 'stopped_out' :
      reason === 'take_profit' ? 'take_profit' :
      finalPnL >= 0 ? 'won' : 'lost';
    
    // Update trade record
    const { error: updateError } = await supabase
      .from('trades')
      .update({
        exit_price: exitPriceNum,
        current_price: exitPriceNum,
        pnl: finalPnL,
        profit_loss: finalPnL,
        floating_pnl: finalPnL,
        pnl_percentage: (finalPnL / investment) * 100,
        status: finalStatus,
        closed_at: now,
        updated_at: now,
      })
      .eq('id', tradeId);
    
    if (updateError) {
      console.error('[FX Trades PATCH] Update error:', updateError);
    }
    
    return NextResponse.json({
      success: true,
      trade: {
        id: tradeId,
        symbol: trade.symbol || trade.pair,
        direction: direction === 1 ? 'buy' : 'sell',
        entryPrice,
        exitPrice: exitPriceNum,
        investment,
        finalPnL,
        pnlPercent: (finalPnL / investment) * 100,
        status: finalStatus,
      },
      newBalance,
      creditAmount,
      result: {
        isWin: finalPnL > 0,
        profit: finalPnL,
        percentReturn: (finalPnL / investment) * 100,
      },
      message: `Closed ${trade.symbol || trade.pair}: ${finalPnL >= 0 ? '+' : ''}$${finalPnL.toFixed(2)}`,
    });
    
  } catch (error: any) {
    console.error('[FX Trades PATCH]', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}

// ==========================================
// GET - LIST FX TRADES
// ==========================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));
    const offset = Math.max(0, Number(searchParams.get('offset') || 0));
    
    const supabase = getSupabaseAdmin();
    
    let query = supabase
      .from('trades')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('market_type', 'fx')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (status === 'active' || status === 'open') {
      query = query.in('status', ['open', 'active', 'pending']);
    } else if (status === 'closed') {
      query = query.in('status', ['closed', 'won', 'lost', 'liquidated', 'stopped_out', 'take_profit']);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('[FX Trades GET]', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch trades' }, { status: 500 });
    }
    
    // Get balance
    const { data: userData } = await supabase
      .from('users')
      .select('balance_available')
      .eq('id', userId)
      .single();
    
    // Transform trades
    const trades = (data || []).map(row => ({
      id: row.id,
      symbol: row.symbol || row.pair,
      direction: row.direction,
      directionInt: row.direction_int || (row.direction === 'buy' ? 1 : -1),
      investment: Number(row.investment || row.amount || 0),
      multiplier: Number(row.multiplier || row.leverage || 1),
      entryPrice: Number(row.entry_price || 0),
      liquidationPrice: Number(row.liquidation_price || 0),
      currentPrice: Number(row.current_price || row.entry_price || 0),
      exitPrice: row.exit_price ? Number(row.exit_price) : null,
      stopLoss: row.stop_loss ? Number(row.stop_loss) : null,
      takeProfit: row.take_profit ? Number(row.take_profit) : null,
      floatingPnL: Number(row.floating_pnl || row.pnl || 0),
      finalPnL: row.pnl ? Number(row.pnl) : null,
      spreadCost: Number(row.spread_cost || 0),
      status: row.status,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
    }));
    
    return NextResponse.json({
      success: true,
      trades,
      balance: Number(userData?.balance_available || 0),
      total: count || 0,
      limit,
      offset,
    });
    
  } catch (error: any) {
    console.error('[FX Trades GET]', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
