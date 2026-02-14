// app/api/trades/route.ts
/**
 * OLYMP-STYLE TRADES API
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
    return { user: null as any, error: 'Missing or invalid authorization header', status: 401 };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null as any, error: 'Invalid or expired token', status: 401 };
  }

  return { user: data.user, error: null as any, status: 200 };
}

// ============================================
// HELPERS
// ============================================
function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(v: any, fallback = NaN) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeDbErrorMessage(msg: string): string {
  const s = String(msg || '').trim();
  if (!s) return 'Database error';

  // Cloudflare HTML / upstream 500 sometimes leaks as a huge HTML document
  const lower = s.toLowerCase();
  if (lower.includes('<!doctype html') || lower.includes('<html') || lower.includes('cloudflare')) {
    return 'Database error (upstream 500). Check Supabase logs for the real cause.';
  }

  // keep it short + readable
  return s.replace(/\s+/g, ' ').slice(0, 400);
}

function normalizeNewBalance(result: any): number | null {
  const v =
    result?.new_balance ??
    result?.newAvailable ??
    result?.newavailable ??
    result?.balance ??
    null;

  const n = toNumber(v, NaN);
  return Number.isFinite(n) ? n : null;
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

    const inv = toNumber(investment);
    const multNum = toNumber(multiplier);
    const price = toNumber(marketPrice);

    if (!Number.isFinite(inv) || inv <= 0) {
      return NextResponse.json({ success: false, error: 'Investment must be positive' }, { status: 400 });
    }

    // ✅ force integer multiplier (prevents ambiguous function matches)
    const multInt = Math.trunc(multNum);
    if (!Number.isFinite(multNum) || multInt < 1 || multInt > 1000 || multInt !== multNum) {
      return NextResponse.json(
        { success: false, error: 'Multiplier must be an integer between 1 and 1000' },
        { status: 400 }
      );
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
      multiplier: multInt,
   marketMidPrice: price,
      stopLoss: stopLoss != null ? Number(stopLoss) : undefined,
      takeProfit: takeProfit != null ? Number(takeProfit) : undefined,
    };

    const { trade, error: createError } = OlympTradingEngine.createTrade(tradeParams);
    if (createError || !trade) {
      return NextResponse.json({ success: false, error: createError || 'Failed to create trade' }, { status: 400 });
    }

    // ✅ DB uuid id
    const dbTradeId = crypto.randomUUID();

    // ✅ call your CURRENT function signature (matches what you pasted)
    // open_trade_atomic(
    //   p_asset text, p_direction text, p_entry_price numeric, p_investment numeric,
    //   p_liquidation_price numeric, p_multiplier integer, p_trade_id uuid, p_user_id uuid,
    //   p_stop_loss numeric default null, p_take_profit numeric default null
    // )
    const { data: result, error: dbError } = await supabase.rpc('open_trade_atomic', {
      p_asset: trade.asset,
      p_direction: trade.direction === 1 ? 'buy' : 'sell',
      p_entry_price: trade.entryPrice,
      p_investment: trade.investment,
      p_liquidation_price: trade.liquidationPrice,
      p_multiplier: multInt,
      p_trade_id: dbTradeId,
      p_user_id: user.id,
      p_stop_loss: trade.stopLoss ?? null,
      p_take_profit: trade.takeProfit ?? null,
    });

    if (dbError) {
      const msg = sanitizeDbErrorMessage(dbError.message);
      console.error('[Trades API] Atomic open failed:', dbError);

      // make this one readable for the UI
      if (msg.includes('INSUFFICIENT_BALANCE')) {
        return NextResponse.json({ success: false, error: 'Trade execution failed: INSUFFICIENT_BALANCE' }, { status: 400 });
      }

      return NextResponse.json({ success: false, error: 'Trade execution failed: ' + msg }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json({ success: false, error: result?.error || 'Trade rejected' }, { status: 400 });
    }

    // store idempotency (DB uuid)
    if (clientKey) setIdempotency(`${user.id}:${clientKey}`, dbTradeId);
    setIdempotency(serverKey, dbTradeId);

    const newBal = normalizeNewBalance(result);

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
        spreadCost: trade.spreadCostUsd,

        status: 'active',
      },
      newBalance: newBal ?? undefined,
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
    if (String(trade.status).toLowerCase() !== 'active') {
      return NextResponse.json({ success: false, error: 'Trade is not active' }, { status: 400 });
    }

    const investment = toNumber(trade.investment ?? trade.amount ?? 0, 0);
    const multiplier = toNumber(trade.multiplier ?? trade.leverage ?? 1, 1);
    const entryPrice = toNumber(trade.entry_price ?? trade.entryPrice, NaN);

    // ✅ guard exit price (prevents NaN PnL and weird DB errors)
    const exit = exitPrice ?? trade.current_price ?? trade.exit_price;
    const finalExitPrice = toNumber(exit, NaN);

    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      return NextResponse.json({ success: false, error: 'Bad entry price on trade record' }, { status: 400 });
    }
    if (!Number.isFinite(finalExitPrice) || finalExitPrice <= 0) {
      return NextResponse.json({ success: false, error: 'Exit price must be a valid number > 0' }, { status: 400 });
    }

    const direction =
      toNumber(trade.direction_int, NaN) === 1 ? 1 :
      toNumber(trade.direction_int, NaN) === -1 ? -1 :
      String(trade.direction).toLowerCase() === 'buy' ? 1 : -1;

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
      const msg = sanitizeDbErrorMessage(closeError.message);
      console.error('[Trades API] Atomic close failed:', closeError);
      return NextResponse.json({ success: false, error: 'Trade close failed: ' + msg }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json({ success: false, error: result?.error || 'Close rejected' }, { status: 400 });
    }

    const newBal = normalizeNewBalance(result);
    const creditAmt = toNumber(result?.credit_amount, 0);

    return NextResponse.json({
      success: true,
      trade: {
        id: tradeId,
        status: newStatus,
        exitPrice: finalExitPrice,
        finalPnL,
        creditAmount: creditAmt,
      },
      newBalance: newBal ?? undefined,
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
