// app/api/trades/route.ts
/**
 * OLYMP-STYLE TRADES API
 *
 * ENDPOINTS:
 * POST /api/trades  - Open new trade (atomic balance deduction)
 * GET  /api/trades  - Get user's trades
 * PATCH /api/trades - Close trade (atomic balance credit)
 *
 * NOTE:
 * - DB is the judge. close_trade_atomic now computes FX margin principal+pnl even if client/API is wrong.
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

  const lower = s.toLowerCase();
  if (lower.includes('<!doctype html') || lower.includes('<html') || lower.includes('cloudflare')) {
    return 'Database error (upstream 500). Check Supabase logs for the real cause.';
  }
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
    const qMarket = searchParams.get('market_type') || searchParams.get('marketType');

    const limit = clampInt(parseInt(searchParams.get('limit') || '50', 10) || 50, 1, 200);
    const offset = clampInt(parseInt(searchParams.get('offset') || '0', 10) || 0, 0, 100000);

    let query = supabase
      .from('trades')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (qStatus) query = query.eq('status', qStatus);
    if (qMarket) query = query.eq('market_type', qMarket);

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

    const supabase = getSupabaseAdmin();

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

    const dbTradeId = crypto.randomUUID();

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

      if (msg.includes('INSUFFICIENT_BALANCE')) {
        return NextResponse.json({ success: false, error: 'Trade execution failed: INSUFFICIENT_BALANCE' }, { status: 400 });
      }

      return NextResponse.json({ success: false, error: 'Trade execution failed: ' + msg }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json({ success: false, error: result?.error || 'Trade rejected' }, { status: 400 });
    }

    // mark FX fields for this endpoint (safe extra update)
    if (String(assetType).toLowerCase() === 'forex') {
      try {
        await supabase
          .from('trades')
          .update({
            market_type: 'fx',
            trade_type: 'margin',
            leverage: multInt,
            pair: asset,
          })
          .eq('id', dbTradeId)
          .eq('user_id', user.id);
      } catch (e) {
        // non-fatal
        console.warn('[Trades API] FX metadata update skipped', e);
      }
    }

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

    const entryPrice = toNumber(trade.entry_price ?? trade.entryPrice, NaN);

    const exit = exitPrice ?? trade.current_price ?? trade.exit_price;
    const finalExitPrice = toNumber(exit, NaN);

    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
      return NextResponse.json({ success: false, error: 'Bad entry price on trade record' }, { status: 400 });
    }
    if (!Number.isFinite(finalExitPrice) || finalExitPrice <= 0) {
      return NextResponse.json({ success: false, error: 'Exit price must be a valid number > 0' }, { status: 400 });
    }

    const directionInt =
      toNumber(trade.direction_int, NaN) === 1 ? 1 :
      toNumber(trade.direction_int, NaN) === -1 ? -1 :
      String(trade.direction).toLowerCase() === 'sell' ? -1 : 1;

    const isFxMargin =
      String(trade.market_type || '').toLowerCase() === 'fx' &&
      String(trade.trade_type || '').toLowerCase() === 'margin';

    let principal = toNumber(trade.investment, 0);
    let finalPnL = toNumber(trade.pnl, 0);

    if (isFxMargin) {
      const amount = toNumber(trade.amount, 0);        // notional
      const qty = toNumber(trade.quantity, 0);
      const lev = toNumber(trade.leverage ?? trade.multiplier, 0);

      // principal (margin) guess: investment/margin_used/amount/leverage
      const marginUsed = toNumber(trade.margin_used, 0);
      if (principal <= 0) principal = marginUsed > 0 ? marginUsed : (amount > 0 && lev > 0 ? amount / lev : 0);

      // notional for pnl: prefer amount, else qty*entry
      const notional = amount > 0 ? amount : (qty > 0 ? qty * entryPrice : (principal > 0 && lev > 0 ? principal * lev : 0));

      const rel = (finalExitPrice - entryPrice) / entryPrice;
      finalPnL = directionInt * notional * rel;

      // cap loss to -principal (if principal known)
      if (principal > 0 && finalPnL < -principal) finalPnL = -principal;
    } else {
      // olymp-style
      const investment = toNumber(trade.investment ?? trade.amount ?? 0, 0);
      const multiplier = toNumber(trade.multiplier ?? trade.leverage ?? 1, 1);
      const relativeChange = (finalExitPrice - entryPrice) / entryPrice;

      principal = investment;
      finalPnL = directionInt * investment * multiplier * relativeChange;

      if (finalPnL < -investment) finalPnL = -investment;
    }

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
      p_investment: principal,
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
    const dbFinalPnL = toNumber(result?.final_pnl, finalPnL);

    return NextResponse.json({
      success: true,
      trade: {
        id: tradeId,
        status: newStatus,
        exitPrice: finalExitPrice,
        finalPnL: dbFinalPnL,
        creditAmount: creditAmt,
      },
      newBalance: newBal ?? undefined,
      result: {
        isWin: dbFinalPnL > 0,
        profit: dbFinalPnL,
        percentReturn: principal > 0 ? (dbFinalPnL / principal) * 100 : 0,
      },
      message: `Trade closed: ${dbFinalPnL >= 0 ? '+' : ''}$${dbFinalPnL.toFixed(2)}`,
    });
  } catch (e: any) {
    console.error('[Trades API] PATCH Exception:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
