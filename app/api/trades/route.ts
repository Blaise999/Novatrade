// app/api/trades/route.ts
/**
 * OLYMP-STYLE TRADES API
 *
 * Server-side execution ONLY - the App is just a TV screen, the Server is the judge.
 *
 * ENDPOINTS:
 * POST /api/trades  - Open new trade (atomic balance deduction)
 * GET  /api/trades  - Get user's trades
 * PATCH /api/trades - Close trade (atomic balance credit)
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OlympTradingEngine, { TradeOpenParams } from '@/lib/services/olymp-trading-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================
// SUPABASE ADMIN CLIENT
// ============================================
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error('Supabase not configured');

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ============================================
// AUTH (Supabase-native)
// ============================================
function extractBearerToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}

async function requireUser(req: NextRequest) {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      user: null as any,
      error: 'Missing or invalid authorization header',
      status: 401,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return {
      user: null as any,
      error: 'Invalid or expired token',
      status: 401,
    };
  }

  return { user: data.user, error: null as any, status: 200 };
}

// ============================================
// IDEMPOTENCY
// ============================================
const idempotencyCache = new Map<string, { tradeId: string; expiresAt: number }>();
const IDEMPOTENCY_TTL = 5 * 60 * 1000;

function checkIdempotency(key: string): string | null {
  const record = idempotencyCache.get(key);

  if (idempotencyCache.size > 10000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache.entries()) {
      if (now > v.expiresAt) idempotencyCache.delete(k);
    }
  }

  if (record && Date.now() < record.expiresAt) return record.tradeId;
  return null;
}

function setIdempotency(key: string, tradeId: string) {
  idempotencyCache.set(key, { tradeId, expiresAt: Date.now() + IDEMPOTENCY_TTL });
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ============================================
// GET /api/trades
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { user, error, status } = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error }, { status });

    const supabase = getSupabaseAdmin();
    const { searchParams } = request.nextUrl;

    const qStatus = searchParams.get('status');
    const limit = clampInt(parseInt(searchParams.get('limit') || '50', 10) || 50, 1, 200);
    const offset = clampInt(parseInt(searchParams.get('offset') || '0', 10) || 0, 0, 100000);

    let query = supabase
      .from('trades')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (qStatus) query = query.eq('status', qStatus);

    const { data: trades, error: fetchErr, count } = await query;

    if (fetchErr) {
      console.error('[Trades API] GET Error:', fetchErr);
      return NextResponse.json({ success: false, error: 'Failed to fetch trades' }, { status: 500 });
    }

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
  } catch (e: any) {
    console.error('[Trades API] GET Exception:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST /api/trades - OPEN TRADE
// ============================================
export async function POST(request: NextRequest) {
  try {
    const { user, error, status } = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error }, { status });

    const body = await request.json();
    const {
      asset,
      assetType = 'forex',
      direction,
      investment,
      multiplier,
      marketPrice,
      stopLoss,
      takeProfit,
      idempotencyKey,
    } = body ?? {};

    // idempotency key
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

    // validation
    if (!asset || !direction || investment == null || multiplier == null || marketPrice == null) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: asset, direction, investment, multiplier, marketPrice' },
        { status: 400 }
      );
    }

    const inv = Number(investment);
    const mult = Number(multiplier);
    const price = Number(marketPrice);

    if (!Number.isFinite(inv) || inv <= 0) {
      return NextResponse.json({ success: false, error: 'Investment must be positive' }, { status: 400 });
    }
    if (!Number.isFinite(mult) || mult < 1 || mult > 1000) {
      return NextResponse.json({ success: false, error: 'Multiplier must be between 1 and 1000' }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ success: false, error: 'marketPrice must be a valid number' }, { status: 400 });
    }

    // optional tier check
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
        return NextResponse.json(
          {
            success: false,
            error: 'Upgrade required: You need at least Starter tier to trade.',
            requiresTier: 1,
          },
          { status: 403 }
        );
      }
    } catch (tierErr) {
      console.warn('[Trades API] Tier check skipped:', tierErr);
    }

    // build engine trade
    const tradeParams: TradeOpenParams = {
      userId: user.id,
      asset,
      assetType,
      direction,
      investment: inv,
      multiplier: mult,
      marketPrice: price,
      stopLoss: stopLoss != null ? Number(stopLoss) : undefined,
      takeProfit: takeProfit != null ? Number(takeProfit) : undefined,
    };

    const { trade, error: createError } = OlympTradingEngine.createTrade(tradeParams);
    if (createError || !trade) {
      return NextResponse.json({ success: false, error: createError || 'Failed to create trade' }, { status: 400 });
    }

    // ✅ DB uuid id
    const dbTradeId = crypto.randomUUID();

    // atomic open
    const { data: result, error: dbError } = await supabase.rpc('open_trade_atomic', {
      p_user_id: user.id,
      p_trade_id: dbTradeId,
      p_investment: trade.investment,
      p_asset: trade.asset,
      p_direction: trade.direction === 1 ? 'buy' : 'sell',
      p_multiplier: trade.multiplier,
      p_entry_price: trade.entryPrice,
      p_liquidation_price: trade.liquidationPrice,
      p_stop_loss: trade.stopLoss ?? null,
      p_take_profit: trade.takeProfit ?? null,
    });

    if (dbError) {
      console.error('[Trades API] Atomic open failed:', dbError);
      return NextResponse.json({ success: false, error: 'Trade execution failed: ' + dbError.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json({ success: false, error: result?.error || 'Trade rejected' }, { status: 400 });
    }

    // store idempotency (DB uuid)
    if (clientKey) setIdempotency(`${user.id}:${clientKey}`, dbTradeId);
    setIdempotency(serverKey, dbTradeId);

    return NextResponse.json({
      success: true,
      trade: {
        id: dbTradeId,
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
  } catch (e: any) {
    console.error('[Trades API] POST Exception:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// PATCH /api/trades - CLOSE TRADE
// ============================================
export async function PATCH(request: NextRequest) {
  try {
    const { user, error, status } = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error }, { status });

    const body = await request.json();
    const { tradeId, action = 'close', exitPrice, closeReason = 'manual' } = body ?? {};

    if (!tradeId) return NextResponse.json({ success: false, error: 'Trade ID required' }, { status: 400 });
    if (action !== 'close') return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 });

    // quick uuid format check
    const uuidOk =
      typeof tradeId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tradeId);

    if (!uuidOk) {
      return NextResponse.json({ success: false, error: 'Invalid tradeId (must be uuid)' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: trade, error: fetchError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !trade) return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    if (trade.status !== 'active') return NextResponse.json({ success: false, error: 'Trade is not active' }, { status: 400 });

    const investment = Number(trade.investment || trade.amount || 0);
    const multiplier = Number(trade.multiplier || trade.leverage || 1);
    const entryPrice = Number(trade.entry_price || trade.entryPrice);
    const finalExitPrice = Number(exitPrice ?? trade.current_price);
    const direction = Number(trade.direction_int) || (trade.direction === 'buy' ? 1 : -1);

    const relativeChange = (finalExitPrice - entryPrice) / entryPrice;
    let finalPnL = direction * investment * multiplier * relativeChange;
    if (finalPnL < -investment) finalPnL = -investment;

    const newStatus =
      closeReason === 'liquidated'
        ? 'liquidated'
        : closeReason === 'stopped_out'
          ? 'stopped_out'
          : closeReason === 'take_profit'
            ? 'take_profit'
            : 'closed';

    const { data: result, error: closeError } = await supabase.rpc('close_trade_atomic', {
      p_trade_id: tradeId,
      p_user_id: user.id,
      p_exit_price: finalExitPrice,
      p_final_pnl: finalPnL,
      p_investment: investment,
      p_status: newStatus,
    });

    if (closeError) {
      console.error('[Trades API] Atomic close failed:', closeError);
      return NextResponse.json({ success: false, error: 'Trade close failed: ' + closeError.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json({ success: false, error: result?.error || 'Close rejected' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      trade: {
        id: tradeId,
        status: newStatus,
        exitPrice: finalExitPrice,
        finalPnL,
        creditAmount: result.credit_amount,
      },
      newBalance: result.new_balance,
      result: {
        isWin: finalPnL > 0,
        profit: finalPnL,
        percentReturn: investment > 0 ? (finalPnL / investment) * 100 : 0,
      },
      message: `Trade closed: ${finalPnL >= 0 ? '+' : ''}$${finalPnL.toFixed(2)}`,
    });
  } catch (e: any) {
    console.error('[Trades API] PATCH Exception:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
