// app/api/trades/route.ts
/**
 * TRADES API (server-side judge)
 *
 * ENDPOINTS:
 *  - GET    /api/trades   => list user trades (+balance)
 *  - POST   /api/trades   => open trade (atomic via open_trade_atomic)
 *  - PATCH  /api/trades   => close trade OR mark_price (revalue FX + SL/TP)
 *
 * IMPORTANT:
 *  - mark_price MUST call revalue_fx_trades(user, pair, mid) so DB updates:
 *      current_price, floating_pnl, pnl_percentage, and auto-close on SL/TP/liq
 *  - open/close uses SECURITY DEFINER SQL RPCs for atomic balance locking/credit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Json = Record<string, any>;

function json(res: Json, status = 200) {
  return NextResponse.json(res, { status });
}

function getBearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function clampNum(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isUuid(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function makeUUID(): string {
  try {
    const id = globalThis.crypto?.randomUUID?.();
    if (id) return id;
  } catch {}
  // fallback (not perfect but ok)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function normPair(asset: string): { pair: string; symbol: string } {
  const pair = asset.trim();
  const symbol = pair.includes('/') ? pair.toUpperCase().replace('/', '_') : pair.toUpperCase();
  return { pair, symbol };
}

function dirInt(direction: unknown): 1 | -1 {
  const s = String(direction ?? '').toLowerCase();
  return s === 'buy' || s === 'long' || s === 'up' ? 1 : -1;
}

function calcLiq(entry: number, leverage: number, d: 1 | -1) {
  if (!(entry > 0) || !(leverage > 0)) return 0;
  // BUY: entry*(1-1/L), SELL: entry*(1+1/L)
  return entry * (1 - d / leverage);
}

async function readJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function supabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '';

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'novatrade-api-trades' } },
  });
}

async function requireUser(req: NextRequest) {
  const admin = supabaseAdmin();
  if (!admin) return { ok: false as const, error: 'Server misconfigured (missing Supabase env keys)', status: 500 };

  const token = getBearer(req);
  if (!token) return { ok: false as const, error: 'Missing Authorization Bearer token', status: 401 };

  const { data, error } = await admin.auth.getUser(token);
  const userId = data?.user?.id || null;

  if (error || !userId) return { ok: false as const, error: 'Invalid or expired token', status: 401 };

  return { ok: true as const, admin, userId };
}

async function getUserBalances(admin: any, userId: string) {
  const { data } = await admin
    .from('users')
    .select('balance_available, balance_locked, bonus_balance, balance')
    .eq('id', userId)
    .maybeSingle();

  // different schemas store balance in different columns
  const bal =
    data?.balance_available ??
    data?.balance ??
    0;

  return {
    balance: clampNum(bal, 0),
    balance_available: clampNum(data?.balance_available ?? bal, 0),
    balance_locked: clampNum(data?.balance_locked ?? 0, 0),
    bonus_balance: clampNum(data?.bonus_balance ?? 0, 0),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return json({ success: false, error: auth.error }, auth.status);

  const { admin, userId } = auth;

  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 200)));

  // optional mode filtering (active/history/all)
  const mode = String(url.searchParams.get('mode') || 'all').toLowerCase();

  try {
    const q = admin
      .from('trades')
      .select(
        [
          'id',
          'user_id',
          'asset',
          'pair',
          'symbol',
          'asset_type',
          'market_type',
          'trade_type',
          'type',
          'direction',
          'direction_int',
          'investment',
          'amount',
          'leverage',
          'multiplier',
          'entry_price',
          'current_price',
          'exit_price',
          'liquidation_price',
          'stop_loss',
          'take_profit',
          'floating_pnl',
          'final_pnl',
          'pnl',
          'profit_loss',
          'pnl_percentage',
          'status',
          'opened_at',
          'closed_at',
          'created_at',
          'updated_at',
        ].join(',')
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (mode === 'active') q.eq('status', 'active');
    if (mode === 'history') q.neq('status', 'active');

    const { data: trades, error } = await q;

    if (error) throw error;

    const balances = await getUserBalances(admin, userId);

    return json({
      success: true,
      ...balances,
      trades: trades || [],
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Failed to load trades' }, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return json({ success: false, error: auth.error }, auth.status);

  const { admin, userId } = auth;

  const body = (await readJson(req)) || {};
  const asset = String(body.asset || body.pair || body.symbol || '').trim();
  const direction = String(body.direction || body.type || 'buy').toLowerCase();
  const investment = clampNum(body.investment ?? body.margin ?? body.amount, 0);
  const leverage = Math.trunc(clampNum(body.multiplier ?? body.leverage ?? 1, 1));
  const marketPrice = clampNum(body.marketPrice ?? body.marketMidPrice ?? body.entryPrice, 0);

  const stopLoss = body.stopLoss != null && String(body.stopLoss).trim() !== '' ? clampNum(body.stopLoss, 0) : null;
  const takeProfit = body.takeProfit != null && String(body.takeProfit).trim() !== '' ? clampNum(body.takeProfit, 0) : null;

  const idempotencyKey =
    String(body.idempotencyKey || '') ||
    req.headers.get('x-idempotency-key') ||
    req.headers.get('idempotency-key') ||
    '';

  if (!asset) return json({ success: false, error: 'Missing asset/pair' }, 400);
  if (!(investment > 0)) return json({ success: false, error: 'Investment must be > 0' }, 400);
  if (!(marketPrice > 0)) return json({ success: false, error: 'Market price must be > 0' }, 400);
  if (!(leverage >= 1 && leverage <= 1000)) return json({ success: false, error: 'Leverage must be 1..1000' }, 400);

  // idempotency: if the same key was already used, return the existing trade
  if (idempotencyKey) {
    const { data: existing } = await admin
      .from('trades')
      .select('id,status')
      .eq('user_id', userId)
      .eq('idempotency_key', idempotencyKey)
      .order('created_at', { ascending: false })
      .limit(1);

    const ex = Array.isArray(existing) && existing[0] ? existing[0] : null;
    if (ex?.id) {
      const balances = await getUserBalances(admin, userId);
      const { data: tradeRow } = await admin.from('trades').select('*').eq('id', ex.id).maybeSingle();
      return json({ success: true, idempotent: true, trade: tradeRow, ...balances });
    }
  }

  const dInt = dirInt(direction);
  const liq = calcLiq(marketPrice, leverage, dInt);
  const tradeId = isUuid(body.tradeId) ? body.tradeId : makeUUID();

  // For FX margin trades we store:
  //  - investment = margin
  //  - leverage   = leverage
  //  - amount     = notional = margin * leverage
  const notional = investment * leverage;
  const { pair, symbol } = normPair(asset);

  try {
    // Atomic balance lock + basic insert (then we patch FX-specific columns)
    const { data: opened, error: openErr } = await admin.rpc('open_trade_atomic', {
      p_asset: asset,
      p_direction: direction,
      p_entry_price: marketPrice,
      p_investment: investment,
      p_liquidation_price: liq,
      p_multiplier: leverage,
      p_trade_id: tradeId,
      p_user_id: userId,
      p_stop_loss: stopLoss,
      p_take_profit: takeProfit,
    });

    if (openErr) throw openErr;

    // Patch FX fields so PnL logic uses amount/notional + leverage
    const { error: updErr } = await admin
      .from('trades')
      .update({
        market_type: 'fx',
        trade_type: 'margin',
        asset_type: 'forex',
        direction: direction,
        type: direction, // keeps older UI happy
        direction_int: dInt,
        pair: pair,
        symbol: symbol,
        asset: asset, // keep non-null if column exists
        leverage: leverage,
        multiplier: 1, // keep multiplier neutral for FX margin
        investment: investment,
        amount: notional,
        current_price: marketPrice,
        idempotency_key: idempotencyKey || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tradeId)
      .eq('user_id', userId);

    if (updErr) throw updErr;

    const balances = await getUserBalances(admin, userId);
    const { data: tradeRow } = await admin.from('trades').select('*').eq('id', tradeId).maybeSingle();

    return json({
      success: true,
      trade: tradeRow,
      rpc: opened,
      ...balances,
    });
  } catch (e: any) {
    return json({ success: false, error: e?.message || 'Failed to open trade' }, 500);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return json({ success: false, error: auth.error }, auth.status);

  const { admin, userId } = auth;

  const body = (await readJson(req)) || {};
  const action = String(body.action || '').toLowerCase();

  // -------------------------------------------------------
  // mark_price (FX) => call revalue_fx_trades(user, pair, mid)
  // -------------------------------------------------------
  if (action === 'mark_price') {
    const asset = String(body.asset || body.pair || body.symbol || '').trim();
    const price = clampNum(body.price ?? body.midPrice ?? body.marketPrice, 0);
    if (!asset) return json({ success: false, error: 'Missing asset/pair' }, 400);
    if (!(price > 0)) return json({ success: false, error: 'Bad price' }, 400);

    try {
      const { data: rv, error: rvErr } = await admin.rpc('revalue_fx_trades', {
        p_user_id: userId,
        p_pair: asset,
        p_mid_price: price,
      });

      if (rvErr) {
        // helpful message if user forgot to run SQL
        const msg =
          String(rvErr?.message || '').toLowerCase().includes('revalue_fx_trades')
            ? 'Missing SQL function revalue_fx_trades. Run the provided SQL first.'
            : rvErr.message;
        throw new Error(msg);
      }

      const balances = await getUserBalances(admin, userId);

      return json({
        success: true,
        revalue: rv,
        ...balances,
      });
    } catch (e: any) {
      return json({ success: false, error: e?.message || 'mark_price failed' }, 500);
    }
  }

  // -------------------------------------------------------
  // close
  // -------------------------------------------------------
  if (action === 'close') {
    const tradeId = String(body.tradeId || body.id || '').trim();
    const exitPrice = clampNum(body.exitPrice ?? body.price, 0);
    const closeReason = String(body.closeReason || 'manual').toLowerCase();

    if (!isUuid(tradeId)) return json({ success: false, error: 'Bad tradeId' }, 400);
    if (!(exitPrice > 0)) return json({ success: false, error: 'Bad exitPrice' }, 400);

    try {
      // load trade for pnl calc
      const { data: t, error: tErr } = await admin
        .from('trades')
        .select(
          'id,user_id,market_type,trade_type,type,direction,direction_int,investment,amount,leverage,multiplier,entry_price,status'
        )
        .eq('id', tradeId)
        .eq('user_id', userId)
        .maybeSingle();

      if (tErr) throw tErr;
      if (!t?.id) return json({ success: false, error: 'Trade not found' }, 404);

      const entry = clampNum(t.entry_price, 0);
      const invest = clampNum(t.investment ?? 0, 0) || clampNum(body.investment, 0);
      const dInt = (clampNum(t.direction_int, 0) === 1 || clampNum(t.direction_int, 0) === -1)
        ? (clampNum(t.direction_int, 0) as 1 | -1)
        : dirInt(t.direction ?? t.type);

      const marketType = String(t.market_type ?? '').toLowerCase();
      const tradeType = String(t.trade_type ?? t.type ?? '').toLowerCase();
      const isFxMargin = marketType === 'fx' && tradeType === 'margin';

      const lev = clampNum(t.leverage ?? t.multiplier ?? 1, 1);
      const notional =
        isFxMargin
          ? (clampNum(t.amount, 0) > 0 ? clampNum(t.amount, 0) : invest * lev)
          : invest * clampNum(t.multiplier ?? 1, 1);

      let pnl = 0;
      if (entry > 0) {
        const rc = (exitPrice - entry) / entry;
        pnl = dInt * notional * rc;
      }

      // cap loss at -investment (margin)
      if (invest > 0 && pnl < -invest) pnl = -invest;

      const status =
        closeReason === 'liquidated'
          ? 'liquidated'
          : closeReason === 'stopped_out'
            ? 'stopped_out'
            : closeReason === 'take_profit'
              ? 'take_profit'
              : 'closed';

      const { data: closed, error: cErr } = await admin.rpc('close_trade_atomic', {
        p_trade_id: tradeId,
        p_user_id: userId,
        p_exit_price: exitPrice,
        p_final_pnl: pnl,
        p_investment: invest,
        p_status: status,
      });

      if (cErr) throw cErr;

      const balances = await getUserBalances(admin, userId);

      return json({
        success: true,
        close: closed,
        ...balances,
      });
    } catch (e: any) {
      return json({ success: false, error: e?.message || 'Failed to close trade' }, 500);
    }
  }

  return json({ success: false, error: 'Unknown PATCH action' }, 400);
}
