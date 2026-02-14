/**
 * OLYMP-STYLE TRADES API
 * 
 * Server-side execution ONLY - the App is just a TV screen, the Server is the judge.
 * 
 * ENDPOINTS:
 * POST /api/trades - Open new trade (atomic balance deduction)
 * GET /api/trades - Get user's trades
 * PATCH /api/trades - Close trade (atomic balance credit)
 * 
 * CRITICAL: Uses database transactions to prevent:
 * - Double-paying on wins
 * - Missing deductions on losses
 * - Race conditions on concurrent trades
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '@/lib/auth';
import OlympTradingEngine, { OlympTrade, TradeOpenParams } from '@/lib/services/olymp-trading-engine';

// ============================================
// SUPABASE ADMIN CLIENT (for atomic operations)
// ============================================

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

// ============================================
// IDEMPOTENCY PROTECTION
// ============================================

const idempotencyCache = new Map<string, { tradeId: string; expiresAt: number }>();
const IDEMPOTENCY_TTL = 5 * 60 * 1000; // 5 minutes

function checkIdempotency(key: string): string | null {
  const record = idempotencyCache.get(key);
  
  // Clean up expired entries
  if (idempotencyCache.size > 10000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache.entries()) {
      if (now > v.expiresAt) idempotencyCache.delete(k);
    }
  }
  
  if (record && Date.now() < record.expiresAt) {
    return record.tradeId;
  }
  
  return null;
}

function setIdempotency(key: string, tradeId: string): void {
  idempotencyCache.set(key, {
    tradeId,
    expiresAt: Date.now() + IDEMPOTENCY_TTL,
  });
}

// ============================================
// GET /api/trades
// ============================================

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { user, error: authError } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }
    
    const supabase = getSupabaseAdmin();
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: trades, error, count } = await query;
    
    if (error) {
      console.error('[Trades API] GET Error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch trades' },
        { status: 500 }
      );
    }
    
    // Get user balance
    const { data: userData } = await supabase
      .from('users')
      .select('balance_available')
      .eq('id', user.id)
      .single();
    
    return NextResponse.json({
      success: true,
      trades: trades || [],
      balance: Number(userData?.balance_available) || 0,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (trades?.length || 0) === limit,
      },
    });
  } catch (error: any) {
    console.error('[Trades API] GET Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/trades - OPEN NEW TRADE
// ============================================

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { user, error: authError } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }
    
    const body = await request.json();
    const {
      asset,
      assetType = 'forex',
      direction,         // 'buy' | 'sell' | 'up' | 'down'
      investment,        // $ amount risked
      multiplier,        // leverage (x10, x100, etc.)
      marketPrice,       // current market mid price
      stopLoss,
      takeProfit,
      idempotencyKey,
    } = body;
    
    // =========================================
    // IDEMPOTENCY CHECK
    // =========================================
    const clientKey = idempotencyKey || request.headers.get('x-idempotency-key');
    if (clientKey) {
      const existingTradeId = checkIdempotency(`${user.id}:${clientKey}`);
      if (existingTradeId) {
        return NextResponse.json({
          success: true,
          tradeId: existingTradeId,
          message: 'Trade already processed (idempotent)',
          idempotent: true,
        });
      }
    }
    
    // Server-side duplicate detection (5 second window)
    const timeWindow = Math.floor(Date.now() / 5000);
    const serverKey = `${user.id}:${asset}:${investment}:${direction}:${timeWindow}`;
    const existingFromServer = checkIdempotency(serverKey);
    if (existingFromServer) {
      return NextResponse.json({
        success: true,
        tradeId: existingFromServer,
        message: 'Duplicate trade prevented',
        idempotent: true,
      });
    }
    
    // =========================================
    // VALIDATION
    // =========================================
    if (!asset || !direction || !investment || !multiplier || !marketPrice) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: asset, direction, investment, multiplier, marketPrice' },
        { status: 400 }
      );
    }
    
    if (investment <= 0) {
      return NextResponse.json(
        { success: false, error: 'Investment must be positive' },
        { status: 400 }
      );
    }
    
    if (multiplier < 1 || multiplier > 1000) {
      return NextResponse.json(
        { success: false, error: 'Multiplier must be between 1 and 1000' },
        { status: 400 }
      );
    }
    
    // =========================================
    // TIER CHECK (optional)
    // =========================================
    const supabase = getSupabaseAdmin();
    
    try {
      const { data: tierData } = await supabase
        .from('users')
        .select('tier_level, tier_active')
        .eq('id', user.id)
        .maybeSingle();
      
      const tierLevel = Number(tierData?.tier_level ?? 0);
      const tierActive = Boolean(tierData?.tier_active);
      
      if (tierLevel < 1 || !tierActive) {
        return NextResponse.json({
          success: false,
          error: 'Upgrade required: You need at least Starter tier to trade.',
          requiresTier: 1,
        }, { status: 403 });
      }
    } catch (tierErr) {
      console.warn('[Trades API] Tier check skipped:', tierErr);
    }
    
    // =========================================
    // CREATE TRADE OBJECT
    // =========================================
    const tradeParams: TradeOpenParams = {
      userId: user.id,
      asset,
      assetType,
      direction,
      investment: Number(investment),
      multiplier: Number(multiplier),
      marketPrice: Number(marketPrice),
      stopLoss: stopLoss ? Number(stopLoss) : undefined,
      takeProfit: takeProfit ? Number(takeProfit) : undefined,
    };
    
    const { trade, error: createError } = OlympTradingEngine.createTrade(tradeParams);
    
    if (createError || !trade) {
      return NextResponse.json(
        { success: false, error: createError || 'Failed to create trade' },
        { status: 400 }
      );
    }
    
    // =========================================
    // ATOMIC DATABASE OPERATION
    // =========================================
    const { data: result, error: dbError } = await supabase.rpc('open_trade_atomic', {
      p_user_id: user.id,
      p_trade_id: trade.id,
      p_investment: trade.investment,
      p_asset: trade.asset,
      p_direction: trade.direction === 1 ? 'buy' : 'sell',
      p_multiplier: trade.multiplier,
      p_entry_price: trade.entryPrice,
      p_liquidation_price: trade.liquidationPrice,
      p_stop_loss: trade.stopLoss || null,
      p_take_profit: trade.takeProfit || null,
    });
    
    if (dbError) {
      console.error('[Trades API] Atomic open failed:', dbError);
      return NextResponse.json(
        { success: false, error: 'Trade execution failed: ' + dbError.message },
        { status: 500 }
      );
    }
    
    if (!result?.success) {
      return NextResponse.json(
        { success: false, error: result?.error || 'Trade rejected' },
        { status: 400 }
      );
    }
    
    // =========================================
    // SET IDEMPOTENCY KEYS
    // =========================================
    if (clientKey) {
      setIdempotency(`${user.id}:${clientKey}`, trade.id);
    }
    setIdempotency(serverKey, trade.id);
    
    // =========================================
    // SUCCESS RESPONSE
    // =========================================
    return NextResponse.json({
      success: true,
      trade: {
        id: trade.id,
        asset: trade.asset,
        direction: trade.direction === 1 ? 'buy' : 'sell',
        investment: trade.investment,
        multiplier: trade.multiplier,
        volume: trade.volume,
        entryPrice: trade.entryPrice,
        liquidationPrice: trade.liquidationPrice,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        spreadCost: trade.spreadCost,
        status: 'active',
      },
      newBalance: result.new_balance,
      message: `Trade opened: ${trade.direction === 1 ? 'BUY' : 'SELL'} ${trade.asset} @ ${trade.entryPrice.toFixed(5)}`,
    });
    
  } catch (error: any) {
    console.error('[Trades API] POST Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/trades - CLOSE TRADE
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { user, error: authError } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }
    
    const body = await request.json();
    const {
      tradeId,
      action = 'close',
      exitPrice,
      closeReason = 'manual',  // 'manual' | 'liquidated' | 'stopped_out' | 'take_profit'
    } = body;
    
    if (!tradeId) {
      return NextResponse.json(
        { success: false, error: 'Trade ID required' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseAdmin();
    
    // =========================================
    // GET TRADE
    // =========================================
    const { data: trade, error: fetchError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .eq('user_id', user.id)
      .single();
    
    if (fetchError || !trade) {
      return NextResponse.json(
        { success: false, error: 'Trade not found' },
        { status: 404 }
      );
    }
    
    if (trade.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Trade is not active' },
        { status: 400 }
      );
    }
    
    // =========================================
    // CALCULATE FINAL P/L
    // =========================================
    const investment = Number(trade.investment || trade.amount || 0);
    const multiplier = Number(trade.multiplier || trade.leverage || 1);
    const entryPrice = Number(trade.entry_price || trade.entryPrice);
    const finalExitPrice = Number(exitPrice || trade.current_price);
    const direction = trade.direction_int || (trade.direction === 'buy' ? 1 : -1);
    
    // P/L = D × I × M × ((P_exit - P_entry) / P_entry)
    const relativeChange = (finalExitPrice - entryPrice) / entryPrice;
    let finalPnL = direction * investment * multiplier * relativeChange;
    
    // Cap loss at investment
    if (finalPnL < -investment) {
      finalPnL = -investment;
    }
    
    // Determine status
    const status = 
      closeReason === 'liquidated' ? 'liquidated' :
      closeReason === 'stopped_out' ? 'stopped_out' :
      closeReason === 'take_profit' ? 'take_profit' :
      'closed';
    
    // =========================================
    // ATOMIC DATABASE OPERATION
    // =========================================
    const { data: result, error: closeError } = await supabase.rpc('close_trade_atomic', {
      p_trade_id: tradeId,
      p_user_id: user.id,
      p_exit_price: finalExitPrice,
      p_final_pnl: finalPnL,
      p_investment: investment,
      p_status: status,
    });
    
    if (closeError) {
      console.error('[Trades API] Atomic close failed:', closeError);
      return NextResponse.json(
        { success: false, error: 'Trade close failed: ' + closeError.message },
        { status: 500 }
      );
    }
    
    if (!result?.success) {
      return NextResponse.json(
        { success: false, error: result?.error || 'Close rejected' },
        { status: 400 }
      );
    }
    
    // =========================================
    // SUCCESS RESPONSE
    // =========================================
    return NextResponse.json({
      success: true,
      trade: {
        id: tradeId,
        status,
        exitPrice: finalExitPrice,
        finalPnL,
        creditAmount: result.credit_amount,
      },
      newBalance: result.new_balance,
      result: {
        isWin: finalPnL > 0,
        profit: finalPnL,
        percentReturn: (finalPnL / investment) * 100,
      },
      message: `Trade closed: ${finalPnL >= 0 ? '+' : ''}$${finalPnL.toFixed(2)}`,
    });
    
  } catch (error: any) {
    console.error('[Trades API] PATCH Exception:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
