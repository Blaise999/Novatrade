// app/api/market/fx/candles/route.ts
/**
 * FX CANDLES API - TWELVE DATA OHLC (SHARED CACHE + "fresh=1" REFRESH)
 * ====================================================================
 *
 * Key idea:
 * - Client can poll THIS endpoint often.
 * - This endpoint ONLY calls TwelveData when:
 *    - cache is missing, OR
 *    - request includes fresh=1 AND per-key interval + budgets allow it.
 *
 * This prevents:
 * - blowing TwelveData daily cap (800/day)
 * - per-minute cap (8/min)
 * - serverless multi-instance bypass (shared cache + shared budget)
 *
 * Query:
 * - display=EUR/USD (preferred)
 * - symbol=OANDA:EUR_USD (converted)
 * - tf=1m|5m|15m|1h|4h|1D
 * - limit=10..500 (default 120)
 * - fresh=1 (force refresh from TwelveData if allowed)
 *
 * Env:
 * - TWELVEDATA_API_KEY (required)
 * - NEXT_PUBLIC_SUPABASE_URL (required for shared cache)
 * - SUPABASE_SERVICE_ROLE_KEY (required for shared cache + budgets)
 *
 * Knobs (optional):
 * - FX_TWELVEDATA_CREDITS_PER_MIN   (default 7)
 * - FX_TWELVEDATA_CREDITS_PER_DAY   (default 760)  // keep a safety buffer under 800
 * - FX_TWELVEDATA_MIN_INTERVAL_MS   (default 120000) // 2 min per pair+tf+limit
 * - FX_CANDLES_CACHE_TTL_MS         (default 120000) // "fresh" threshold for UI
 * - FX_CANDLES_STALE_MAX_MS         (default 21600000) // 6h: still serve stale if provider blocks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TWELVE_BASE = 'https://api.twelvedata.com';
const DEBUG = process.env.DEBUG_MARKET === '1';

const CREDITS_PER_MIN = Math.max(1, parseInt(process.env.FX_TWELVEDATA_CREDITS_PER_MIN || '7', 10) || 7);
const CREDITS_PER_DAY = Math.max(1, parseInt(process.env.FX_TWELVEDATA_CREDITS_PER_DAY || '760', 10) || 760);

const MIN_UPSTREAM_INTERVAL_MS = Math.max(
  5_000,
  parseInt(process.env.FX_TWELVEDATA_MIN_INTERVAL_MS || '120000', 10) || 120000
);

const CACHE_TTL_MS = Math.max(5_000, parseInt(process.env.FX_CANDLES_CACHE_TTL_MS || '120000', 10) || 120000);
const STALE_MAX_MS = Math.max(CACHE_TTL_MS, parseInt(process.env.FX_CANDLES_STALE_MAX_MS || '21600000', 10) || 21600000);

function log(...args: any[]) {
  if (DEBUG) console.log('[FX/candles]', ...args);
}

function safeSnippet(v: string, max = 240) {
  const t = String(v || '');
  return t.length > max ? t.slice(0, max) + '…' : t;
}

// =====================
// TIMEFRAME UTILITIES
// =====================

function tfNorm(tf: string): string {
  const t = String(tf || '').trim();
  if (t.toLowerCase() === '1d') return '1D';
  return t;
}

function tfToResolution(tfRaw: string): string {
  const tf = tfNorm(tfRaw);
  switch (tf) {
    case '1m': return '1';
    case '5m': return '5';
    case '15m': return '15';
    case '1h': return '60';
    case '4h': return '240';
    case '1D': return 'D';
    default: return '15';
  }
}

function tfToTwelveInterval(tfRaw: string): string {
  const tf = tfNorm(tfRaw);
  switch (tf) {
    case '1m': return '1min';
    case '5m': return '5min';
    case '15m': return '15min';
    case '1h': return '1h';
    case '4h': return '4h';
    case '1D': return '1day';
    default: return '15min';
  }
}

// =====================
// SYMBOL CONVERSION
// =====================

function toTwelveDisplay(symbolParam: string, displayParam: string): string {
  const symbol = (symbolParam || '').trim();
  const display = (displayParam || '').trim();

  if (display) return display.toUpperCase();

  if (symbol && symbol.includes(':')) {
    const stripped = symbol.split(':').slice(1).join(':');
    return stripped.toUpperCase().split('_').join('/');
  }

  if (symbol && symbol.includes('_')) return symbol.toUpperCase().split('_').join('/');

  if (symbol && symbol.length === 6) {
    return `${symbol.slice(0, 3).toUpperCase()}/${symbol.slice(3).toUpperCase()}`;
  }

  return symbol.toUpperCase();
}

function toFinnhubStyleSymbolFromDisplay(display: string): string {
  const clean = display.toUpperCase().split('/').join('_');
  return `OANDA:${clean}`;
}

// =====================
// CANDLE PARSING
// =====================

type RawCandle = {
  timestamp: string; // ISO
  time: number;      // epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function parseTwelveDatetimeToEpochSec(dt: string): number {
  const s = String(dt || '').trim();
  if (!s) return 0;
  const iso = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 0;
  return Math.floor(ms / 1000);
}

function epochToIso(sec: number): string {
  return new Date(sec * 1000).toISOString();
}

// =====================
// PAYLOAD TYPES
// =====================

type CachedPayload = {
  ok: true;
  symbol: string;
  display: string;
  tf: string;
  resolution: string;
  count: number;
  candles: Array<{
    time: number;
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  source: string;
  stale?: boolean;
  warning?: string;
  ageSec?: number;
  lastUpdatedAt?: string;
};

// =====================
// SUPABASE (SHARED CACHE)
// =====================

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  const g = globalThis as any;
  if (!g.__sbAdminFxCache) {
    g.__sbAdminFxCache = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return g.__sbAdminFxCache as SupabaseClient;
}

type CacheRow = { key: string; payload: any; updated_at: string };

async function readSharedCache(sb: SupabaseClient, key: string): Promise<{ payload: CachedPayload; updatedAtMs: number; updatedAtIso: string } | null> {
  const { data, error } = await sb
    .from('market_cache')
    .select('key,payload,updated_at')
    .eq('key', key)
    .maybeSingle<CacheRow>();

  if (error || !data?.payload || !data.updated_at) return null;

  const ms = Date.parse(data.updated_at);
  if (!Number.isFinite(ms)) return null;

  return { payload: data.payload as CachedPayload, updatedAtMs: ms, updatedAtIso: data.updated_at };
}

async function writeSharedCache(sb: SupabaseClient, key: string, payload: CachedPayload): Promise<void> {
  const row = { key, payload, updated_at: new Date().toISOString() };
  await sb.from('market_cache').upsert(row, { onConflict: 'key' });
}

// =====================
// SHARED BUDGET (RPC)
// =====================

async function trySpendBudget(sb: SupabaseClient, args: {
  provider: string;
  bucket: 'minute' | 'day';
  windowStartIso: string;
  limit: number;
  cost: number;
}): Promise<{ allowed: boolean; retryAfterSec: number }> {
  // Requires SQL RPC: try_spend_market_budget(...)
  const { data, error } = await sb.rpc('try_spend_market_budget', {
    p_provider: args.provider,
    p_bucket: args.bucket,
    p_window_start: args.windowStartIso,
    p_limit: args.limit,
    p_cost: args.cost,
  });

  if (error) {
    // If RPC missing, do NOT block, but log (you should add the SQL below)
    log('Budget RPC error (missing SQL?):', error.message);
    return { allowed: true, retryAfterSec: 5 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const allowed = !!row?.allowed;
  const retryAfterSec = Math.max(1, Number(row?.retry_after_sec ?? 5));
  return { allowed, retryAfterSec };
}

function minuteWindowStartIso(nowMs: number): string {
  const start = Math.floor(nowMs / 60_000) * 60_000;
  return new Date(start).toISOString();
}

function dayWindowStartIsoUtc(nowMs: number): string {
  const d = new Date(nowMs);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
  return new Date(start).toISOString();
}

// =====================
// IN-FLIGHT DEDUPE (per instance)
// =====================

type InflightValue = { payload: CachedPayload; updatedAtIso: string };

function getInflight() {
  const g = globalThis as any;
  if (!g.__fxCandlesInflight) g.__fxCandlesInflight = new Map<string, Promise<InflightValue>>();
  return g.__fxCandlesInflight as Map<string, Promise<InflightValue>>;
}

function makeKey(display: string, interval: string, limit: number) {
  return `fxcandles|${display}|${interval}|${limit}`;
}

// =====================
// TWELVE DATA FETCHER
// =====================

async function fetchTwelveCandles(params: {
  display: string;
  interval: string;
  limit: number;
  apiKey: string;
}): Promise<{ candles: RawCandle[] | null; error: string | null; status: number }> {
  const url = new URL(`${TWELVE_BASE}/time_series`);
  url.searchParams.set('symbol', params.display);
  url.searchParams.set('interval', params.interval);
  url.searchParams.set('outputsize', String(params.limit));
  url.searchParams.set('apikey', params.apiKey);

  log('Upstream fetch:', { symbol: params.display, interval: params.interval, limit: params.limit });

  try {
    const res = await fetch(url.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' });
    const text = await res.text();

    let json: any = null;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!res.ok || json?.status === 'error') {
      const msg =
        json?.message ||
        json?.error ||
        (res.status === 429 ? 'Rate limited by data provider (try again shortly).' : `Upstream error (${res.status})`);

      log('Upstream error:', { status: res.status, body: safeSnippet(text) });
      const status = res.ok ? 502 : res.status;
      return { candles: null, error: msg, status };
    }

    const values = Array.isArray(json?.values) ? json.values : [];
    const candles: RawCandle[] = values
      .map((x: any) => {
        const t = parseTwelveDatetimeToEpochSec(x?.datetime);
        const o = Number(x?.open);
        const h = Number(x?.high);
        const l = Number(x?.low);
        const c = Number(x?.close);
        const v = Number(x?.volume ?? 0);

        if (!Number.isFinite(t) || t <= 0) return null;
        if (![o, h, l, c].every(Number.isFinite)) return null;

        return {
          time: t,
          timestamp: epochToIso(t),
          open: o,
          high: h,
          low: l,
          close: c,
          volume: Number.isFinite(v) ? v : 0,
        } as RawCandle;
      })
      .filter(Boolean)
      .reverse();

    return { candles, error: null, status: 200 };
  } catch (err: any) {
    return { candles: null, error: err?.message || 'Network error', status: 500 };
  }
}

// =====================
// MAIN HANDLER
// =====================

export async function GET(req: NextRequest) {
  const started = Date.now();

  try {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: 'Missing TWELVEDATA_API_KEY' }, { status: 500 });

    const sb = getSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const symbolParam = (searchParams.get('symbol') || '').trim();
    const displayParam = (searchParams.get('display') || '').trim();

    const tfParam = searchParams.get('tf') || '15m';
    const tf = tfNorm(tfParam);

    const rawLimit = Number(searchParams.get('limit') || 120);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 120, 10), 500);

    const fresh = (searchParams.get('fresh') || '').trim() === '1';

    const display = toTwelveDisplay(symbolParam, displayParam);
    if (!display) {
      return NextResponse.json({ ok: false, error: 'Missing symbol=OANDA:EUR_USD or display=EUR/USD' }, { status: 400 });
    }

    const symbol = toFinnhubStyleSymbolFromDisplay(display);
    const resolution = tfToResolution(tf);
    const interval = tfToTwelveInterval(tf);
    const key = makeKey(display, interval, limit);

    // 1) shared cache read (if supabase configured)
    let cached: { payload: CachedPayload; updatedAtMs: number; updatedAtIso: string } | null = null;
    if (sb) cached = await readSharedCache(sb, key);

    const now = Date.now();

    const respondCached = (payload: CachedPayload, updatedAtIso: string, cacheTag: string, extraHeaders?: Record<string, string>) => {
      const updatedAtMs = Date.parse(updatedAtIso);
      const ageSec = Number.isFinite(updatedAtMs) ? Math.max(0, Math.floor((now - updatedAtMs) / 1000)) : 0;

      const isStaleForUi = Number.isFinite(updatedAtMs) ? (now - updatedAtMs) > CACHE_TTL_MS : false;

      const out: CachedPayload = {
        ...payload,
        symbol,
        display,
        tf,
        resolution,
        ageSec,
        lastUpdatedAt: updatedAtIso,
        stale: payload.stale ?? isStaleForUi,
      };

      return NextResponse.json(out, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Cache': cacheTag,
          'X-Cache-Age': String(ageSec),
          ...(extraHeaders || {}),
        },
      });
    };

    // 2) If NOT fresh and we have cache, ALWAYS serve it (even if "old") to avoid burning credits.
    if (!fresh && cached) {
      const ageMs = now - cached.updatedAtMs;
      if (ageMs <= STALE_MAX_MS) {
        log('Serve cached (no fresh):', { key, ageMs });
        return respondCached(cached.payload, cached.updatedAtIso, ageMs <= CACHE_TTL_MS ? 'HIT' : 'STALE');
      }
      // too old -> allow refresh attempt below
      log('Cache too old, will refresh:', { key, ageMs });
    }

    // 3) In-flight dedupe (per instance)
    const inflight = getInflight();
    const running = inflight.get(key);
    if (running) {
      log('Inflight wait:', { key });
      const done = await running;
      return respondCached(done.payload, done.updatedAtIso, 'DEDUPED');
    }

    // 4) If no Supabase, fall back to safe behavior: block frequent refreshes hard
    if (!sb) {
      if (cached) return respondCached(cached.payload, cached.updatedAtIso, 'HIT_NO_SB');
      return NextResponse.json(
        { ok: false, error: 'Server cache not configured (SUPABASE_SERVICE_ROLE_KEY missing). Add it to enable shared cache.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 5) Per-key interval gate using updated_at as last refresh time (shared across instances)
    if (cached) {
      const sinceLast = now - cached.updatedAtMs;
      if (sinceLast < MIN_UPSTREAM_INTERVAL_MS) {
        const retryAfterSec = Math.max(1, Math.ceil((MIN_UPSTREAM_INTERVAL_MS - sinceLast) / 1000));
        log('Blocked by per-key interval:', { key, retryAfterSec });

        // Serve cached and tell client when it can refresh again
        return respondCached(
          { ...cached.payload, stale: true, warning: 'Refresh too soon; served cached candles.' },
          cached.updatedAtIso,
          'STALE_BLOCKED',
          { 'Retry-After': String(retryAfterSec), 'X-RateLimit-Reason': 'per-key' }
        );
      }
    }

    // 6) Shared budgets (minute + day) BEFORE calling TwelveData
    const cost = 1;
    const minuteSpend = await trySpendBudget(sb, {
      provider: 'twelvedata',
      bucket: 'minute',
      windowStartIso: minuteWindowStartIso(now),
      limit: CREDITS_PER_MIN,
      cost,
    });

    if (!minuteSpend.allowed) {
      const retry = minuteSpend.retryAfterSec;
      log('Blocked by minute budget:', { key, retry });

      if (cached && (now - cached.updatedAtMs) <= STALE_MAX_MS) {
        return respondCached(
          { ...cached.payload, stale: true, warning: 'Minute budget exhausted; served cached candles.' },
          cached.updatedAtIso,
          'STALE_BUDGET_MIN',
          { 'Retry-After': String(retry), 'X-RateLimit-Reason': 'minute-budget' }
        );
      }

      return NextResponse.json(
        { ok: false, error: 'Rate limited (server minute budget). Try again shortly.', retryAfterSec: retry, symbol, display, tf },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retry), 'X-RateLimit-Reason': 'minute-budget' } }
      );
    }

    const daySpend = await trySpendBudget(sb, {
      provider: 'twelvedata',
      bucket: 'day',
      windowStartIso: dayWindowStartIsoUtc(now),
      limit: CREDITS_PER_DAY,
      cost,
    });

    if (!daySpend.allowed) {
      const retry = daySpend.retryAfterSec;
      log('Blocked by day budget:', { key, retry });

      if (cached && (now - cached.updatedAtMs) <= STALE_MAX_MS) {
        return respondCached(
          { ...cached.payload, stale: true, warning: 'Daily budget exhausted; served cached candles.' },
          cached.updatedAtIso,
          'STALE_BUDGET_DAY',
          { 'Retry-After': String(retry), 'X-RateLimit-Reason': 'day-budget' }
        );
      }

      return NextResponse.json(
        { ok: false, error: 'Daily budget exhausted (server). Try later.', retryAfterSec: retry, symbol, display, tf },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retry), 'X-RateLimit-Reason': 'day-budget' } }
      );
    }

    // 7) Upstream fetch (deduped)
    const p = (async (): Promise<InflightValue> => {
      const { candles, error } = await fetchTwelveCandles({ display, interval, limit, apiKey });

      if (error || !candles) {
        // fallback to cache if exists
        const fallback = await readSharedCache(sb, key);
        if (fallback && (Date.now() - fallback.updatedAtMs) <= STALE_MAX_MS) {
          const payload: CachedPayload = {
            ...fallback.payload,
            stale: true,
            warning: error || 'Upstream error; served cached candles.',
            source: `${fallback.payload.source}+cache`,
          };
          return { payload, updatedAtIso: fallback.updatedAtIso };
        }

        throw new Error(error || 'Upstream error');
      }

      const validated = candles.map((c) => ({
        time: c.time,
        timestamp: c.timestamp,
        open: c.open,
        high: Math.max(c.open, c.high, c.low, c.close),
        low: Math.min(c.open, c.high, c.low, c.close),
        close: c.close,
        volume: c.volume || 0,
      }));

      const payload: CachedPayload = {
        ok: true,
        symbol,
        display,
        tf,
        resolution,
        count: validated.length,
        candles: validated,
        source: 'twelvedata',
      };

      await writeSharedCache(sb, key, payload);

      const updatedAtIso = new Date().toISOString();
      return { payload, updatedAtIso };
    })();

    inflight.set(key, p);

    try {
      const done = await p;
      log('200:', { key, count: done.payload.count, tookMs: Date.now() - started });
      return respondCached(done.payload, done.updatedAtIso, 'MISS');
    } finally {
      inflight.delete(key);
    }
  } catch (err: any) {
    log('Exception:', err?.message);
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
