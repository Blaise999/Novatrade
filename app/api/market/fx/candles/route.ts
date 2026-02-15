// app/api/market/fx/candles/route.ts
/**
 * FX CANDLES API - OANDA V20 OHLC (SHARED CACHE + "fresh=1" REFRESH)
 * ================================================================
 *
 * IMPORTANT:
 * - NEVER send OANDA error text to the client.
 * - Provider details stay in server console logs only.
 *
 * Client always gets:
 * - candles payload (prefer cached on any upstream/budget failure), OR
 * - { ok:false, code, ... } with NO provider text.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEBUG = process.env.DEBUG_MARKET === '1';

// OANDA REST base
const OANDA_REST =
  process.env.OANDA_REST_URL ||
  (String(process.env.OANDA_ENV || '').toLowerCase() === 'live'
    ? 'https://api-fxtrade.oanda.com'
    : 'https://api-fxpractice.oanda.com');

const CACHE_TTL_MS = Math.max(5_000, parseInt(process.env.FX_CANDLES_CACHE_TTL_MS || '120000', 10) || 120000);
const STALE_MAX_MS = Math.max(CACHE_TTL_MS, parseInt(process.env.FX_CANDLES_STALE_MAX_MS || '21600000', 10) || 21600000);

const MIN_UPSTREAM_INTERVAL_MS = Math.max(
  2_000,
  parseInt(process.env.FX_OANDA_MIN_INTERVAL_MS || '15000', 10) || 15000
);

// Optional shared budgets (kept so you can throttle globally if needed)
const REQS_PER_MIN = Math.max(1, parseInt(process.env.FX_OANDA_REQS_PER_MIN || '60', 10) || 60);
const REQS_PER_DAY = Math.max(1, parseInt(process.env.FX_OANDA_REQS_PER_DAY || '20000', 10) || 20000);

function log(...args: any[]) {
  if (DEBUG) console.log('[FX/candles:oanda]', ...args);
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
    case '1m':
      return '1';
    case '5m':
      return '5';
    case '15m':
      return '15';
    case '1h':
      return '60';
    case '4h':
      return '240';
    case '1D':
      return 'D';
    default:
      return '15';
  }
}

function tfToOandaGranularity(tfRaw: string): string {
  const tf = tfNorm(tfRaw);
  switch (tf) {
    case '1m':
      return 'M1';
    case '5m':
      return 'M5';
    case '15m':
      return 'M15';
    case '1h':
      return 'H1';
    case '4h':
      return 'H4';
    case '1D':
      return 'D';
    default:
      return 'M15';
  }
}

// =====================
// SYMBOL CONVERSION
// =====================

function toDisplay(symbolParam: string, displayParam: string): string {
  const symbol = (symbolParam || '').trim();
  const display = (displayParam || '').trim();

  if (display) {
    const d = display.toUpperCase();
    if (d.startsWith('OANDA:')) return d.slice(6).split('_').join('/').split('-').join('/');
    if (d.includes('_')) return d.split('_').join('/');
    return d;
  }

  if (symbol && symbol.includes(':')) {
    const stripped = symbol.split(':').slice(1).join(':');
    return stripped.toUpperCase().split('_').join('/').split('-').join('/');
  }

  if (symbol && symbol.includes('_')) return symbol.toUpperCase().split('_').join('/');
  if (symbol && symbol.includes('/')) return symbol.toUpperCase();

  // EURUSD -> EUR/USD
  if (symbol && symbol.length === 6) return `${symbol.slice(0, 3).toUpperCase()}/${symbol.slice(3).toUpperCase()}`;

  return symbol.toUpperCase();
}

function toOandaInstrument(display: string): string {
  const d = String(display || '').trim().toUpperCase();
  if (!d) return '';
  const clean = d.startsWith('OANDA:') ? d.slice(6) : d;
  return clean.replace(/\s+/g, '').split('/').join('_').split('-').join('_');
}

function toSymbol(display: string): string {
  const inst = toOandaInstrument(display);
  return inst ? `OANDA:${inst}` : '';
}

// =====================
// CANDLE PARSING
// =====================

type RawCandle = {
  timestamp: string; // ISO
  time: number; // epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function parseIsoToEpochSec(iso: string): number {
  const ms = Date.parse(String(iso || '').trim());
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
  ageSec?: number;
  lastUpdatedAt?: string;
};

type FailPayload = {
  ok: false;
  code:
    | 'BAD_REQUEST'
    | 'MISSING_API_KEY'
    | 'CACHE_UNAVAILABLE'
    | 'NO_DATA'
    | 'PER_KEY_INTERVAL'
    | 'MINUTE_BUDGET'
    | 'DAY_BUDGET'
    | 'UPSTREAM_LIMIT'
    | 'UPSTREAM_ERROR'
    | 'SERVER_ERROR';
  retryAfterSec?: number;
  symbol?: string;
  display?: string;
  tf?: string;
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

async function readSharedCache(
  sb: SupabaseClient,
  key: string
): Promise<{ payload: CachedPayload; updatedAtMs: number; updatedAtIso: string } | null> {
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

async function trySpendBudget(
  sb: SupabaseClient,
  args: {
    provider: string;
    bucket: 'minute' | 'day';
    windowStartIso: string;
    limit: number;
    cost: number;
  }
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const { data, error } = await sb.rpc('try_spend_market_budget', {
    p_provider: args.provider,
    p_bucket: args.bucket,
    p_window_start: args.windowStartIso,
    p_limit: args.limit,
    p_cost: args.cost,
  });

  if (error) {
    log('Budget RPC error:', error.message);
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

function makeKey(instrument: string, granularity: string, limit: number) {
  return `fxcandles|oanda|${instrument}|${granularity}|${limit}`;
}

// =====================
// UPSTREAM CLASSIFIER
// =====================

type UpstreamFailKind = 'limit' | 'error';

function classifyUpstream(httpStatus: number) {
  if (httpStatus === 429) return 'limit';
  return 'error';
}

// =====================
// OANDA FETCHER (NEVER returns provider text to client)
// =====================

async function fetchOandaCandles(params: {
  instrument: string;
  granularity: string;
  limit: number;
  token: string;
}): Promise<{
  candles: RawCandle[] | null;
  ok: boolean;
  failKind?: UpstreamFailKind;
  httpStatus?: number;
}> {
  const url = new URL(`${OANDA_REST}/v3/instruments/${encodeURIComponent(params.instrument)}/candles`);
  url.searchParams.set('granularity', params.granularity);
  url.searchParams.set('count', String(params.limit));
  url.searchParams.set('price', 'M'); // mid candles

  log('Upstream fetch:', { instrument: params.instrument, granularity: params.granularity, limit: params.limit });

  try {
    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      cache: 'no-store',
    });

    const text = await res.text();

    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!res.ok) {
      // console-only
      log('Upstream error:', {
        status: res.status,
        kind: classifyUpstream(res.status),
        body: safeSnippet(text),
        err: safeSnippet(String(json?.errorMessage || json?.message || json?.error || '')),
      });

      return { candles: null, ok: false, failKind: classifyUpstream(res.status), httpStatus: res.status };
    }

    const arr = Array.isArray(json?.candles) ? json.candles : [];
    const candles: RawCandle[] = arr
      .map((c: any) => {
        const t = parseIsoToEpochSec(c?.time);
        const v = Number(c?.volume ?? 0);

        // Using mid candles (price=M)
        const m = c?.mid || c?.ask || c?.bid;
        const o = Number(m?.o);
        const h = Number(m?.h);
        const l = Number(m?.l);
        const cl = Number(m?.c);

        if (!Number.isFinite(t) || t <= 0) return null;
        if (![o, h, l, cl].every(Number.isFinite)) return null;

        return {
          time: t,
          timestamp: epochToIso(t),
          open: o,
          high: h,
          low: l,
          close: cl,
          volume: Number.isFinite(v) ? v : 0,
        } as RawCandle;
      })
      .filter(Boolean);

    return { candles, ok: true };
  } catch (err: any) {
    log('Upstream exception:', err?.message || err);
    return { candles: null, ok: false, failKind: 'error', httpStatus: 0 };
  }
}

// =====================
// MAIN HANDLER
// =====================

export async function GET(req: NextRequest) {
  const started = Date.now();

  try {
    const token = process.env.OANDA_API_TOKEN;
    if (!token) {
      const out: FailPayload = { ok: false, code: 'MISSING_API_KEY' };
      return NextResponse.json(out, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const sb = getSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const symbolParam = (searchParams.get('symbol') || '').trim();
    const displayParam = (searchParams.get('display') || '').trim();

    const tfParam = searchParams.get('tf') || '15m';
    const tf = tfNorm(tfParam);

    const rawLimit = Number(searchParams.get('limit') || 120);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 120, 10), 500);

    const fresh = (searchParams.get('fresh') || '').trim() === '1';

    const display = toDisplay(symbolParam, displayParam);
    const instrument = toOandaInstrument(display);

    if (!display || !instrument) {
      const out: FailPayload = { ok: false, code: 'BAD_REQUEST' };
      return NextResponse.json(out, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const symbol = toSymbol(display);
    const resolution = tfToResolution(tf);
    const granularity = tfToOandaGranularity(tf);
    const key = makeKey(instrument, granularity, limit);

    // 1) shared cache read (if supabase configured)
    let cached: { payload: CachedPayload; updatedAtMs: number; updatedAtIso: string } | null = null;
    if (sb) cached = await readSharedCache(sb, key);

    const now = Date.now();

    const respondCached = (
      payload: CachedPayload,
      updatedAtIso: string,
      cacheTag: string,
      extraHeaders?: Record<string, string>
    ) => {
      const updatedAtMs = Date.parse(updatedAtIso);
      const ageSec = Number.isFinite(updatedAtMs) ? Math.max(0, Math.floor((now - updatedAtMs) / 1000)) : 0;

      const isStaleForUi = Number.isFinite(updatedAtMs) ? now - updatedAtMs > CACHE_TTL_MS : false;

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

    // 2) If NOT fresh and we have cache, ALWAYS serve it
    if (!fresh && cached) {
      const ageMs = now - cached.updatedAtMs;
      if (ageMs <= STALE_MAX_MS) {
        log('Serve cached (no fresh):', { key, ageMs });
        return respondCached(cached.payload, cached.updatedAtIso, ageMs <= CACHE_TTL_MS ? 'HIT' : 'STALE');
      }
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

    // 4) If no Supabase, fall back to cached if exists
    if (!sb) {
      if (cached) return respondCached(cached.payload, cached.updatedAtIso, 'HIT_NO_SB');
      const out: FailPayload = { ok: false, code: 'CACHE_UNAVAILABLE', symbol, display, tf };
      return NextResponse.json(out, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    // 5) Per-key interval gate (shared across instances via updated_at)
    if (cached) {
      const sinceLast = now - cached.updatedAtMs;
      if (sinceLast < MIN_UPSTREAM_INTERVAL_MS) {
        const retryAfterSec = Math.max(1, Math.ceil((MIN_UPSTREAM_INTERVAL_MS - sinceLast) / 1000));
        log('Blocked by per-key interval:', { key, retryAfterSec });

        return respondCached(
          { ...cached.payload, stale: true },
          cached.updatedAtIso,
          'STALE_BLOCKED',
          { 'Retry-After': String(retryAfterSec), 'X-RateLimit-Reason': 'per-key' }
        );
      }
    }

    // 6) Shared budgets (minute + day) BEFORE calling OANDA
    const cost = 1;

    const minuteSpend = await trySpendBudget(sb, {
      provider: 'oanda',
      bucket: 'minute',
      windowStartIso: minuteWindowStartIso(now),
      limit: REQS_PER_MIN,
      cost,
    });

    if (!minuteSpend.allowed) {
      const retry = minuteSpend.retryAfterSec;
      log('Blocked by minute budget:', { key, retry });

      if (cached && now - cached.updatedAtMs <= STALE_MAX_MS) {
        return respondCached(
          { ...cached.payload, stale: true },
          cached.updatedAtIso,
          'STALE_BUDGET_MIN',
          { 'Retry-After': String(retry), 'X-RateLimit-Reason': 'minute-budget' }
        );
      }

      const out: FailPayload = { ok: false, code: 'MINUTE_BUDGET', retryAfterSec: retry, symbol, display, tf };
      return NextResponse.json(out, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retry), 'X-RateLimit-Reason': 'minute-budget' },
      });
    }

    const daySpend = await trySpendBudget(sb, {
      provider: 'oanda',
      bucket: 'day',
      windowStartIso: dayWindowStartIsoUtc(now),
      limit: REQS_PER_DAY,
      cost,
    });

    if (!daySpend.allowed) {
      const retry = daySpend.retryAfterSec;
      log('Blocked by day budget:', { key, retry });

      if (cached && now - cached.updatedAtMs <= STALE_MAX_MS) {
        return respondCached(
          { ...cached.payload, stale: true },
          cached.updatedAtIso,
          'STALE_BUDGET_DAY',
          { 'Retry-After': String(retry), 'X-RateLimit-Reason': 'day-budget' }
        );
      }

      const out: FailPayload = { ok: false, code: 'DAY_BUDGET', retryAfterSec: retry, symbol, display, tf };
      return NextResponse.json(out, {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retry), 'X-RateLimit-Reason': 'day-budget' },
      });
    }

    // 7) Upstream fetch (deduped)
    const p = (async (): Promise<InflightValue> => {
      const upstream = await fetchOandaCandles({ instrument, granularity, limit, token });

      if (!upstream.ok || !upstream.candles) {
        const fallback = await readSharedCache(sb, key);
        if (fallback && Date.now() - fallback.updatedAtMs <= STALE_MAX_MS) {
          const payload: CachedPayload = {
            ...fallback.payload,
            stale: true,
            source: `${fallback.payload.source}+cache`,
          };
          return { payload, updatedAtIso: fallback.updatedAtIso };
        }

        const kind = upstream.failKind || 'error';
        throw new Error(kind === 'limit' ? 'UPSTREAM_LIMIT' : 'UPSTREAM_ERROR');
      }

      if (!upstream.candles.length) {
        const fallback = await readSharedCache(sb, key);
        if (fallback && Date.now() - fallback.updatedAtMs <= STALE_MAX_MS) {
          const payload: CachedPayload = { ...fallback.payload, stale: true, source: `${fallback.payload.source}+cache` };
          return { payload, updatedAtIso: fallback.updatedAtIso };
        }
        throw new Error('NO_DATA');
      }

      const validated = upstream.candles.map((c) => ({
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
        source: 'oanda',
      };

      await writeSharedCache(sb, key, payload);

      const updatedAtIso = new Date().toISOString();
      return { payload, updatedAtIso };
    })();

    inflight.set(key, p);

    try {
      const done = await p;
      log('200:', { key, count: done.payload.count, tookMs: Date.now() - started });
      return NextResponse.json(
        {
          ...done.payload,
          symbol,
          display,
          tf,
          resolution,
          ageSec: 0,
          lastUpdatedAt: done.updatedAtIso,
          stale: done.payload.stale ?? false,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Cache': 'MISS' } }
      );
    } catch (e: any) {
      const msg = String(e?.message || '');
      const code: FailPayload['code'] =
        msg === 'UPSTREAM_LIMIT' ? 'UPSTREAM_LIMIT' : msg === 'NO_DATA' ? 'NO_DATA' : 'UPSTREAM_ERROR';

      log('No cache to serve; failing:', { key, code });

      const out: FailPayload = { ok: false, code, symbol, display, tf };
      return NextResponse.json(out, {
        status: code === 'UPSTREAM_LIMIT' ? 429 : code === 'NO_DATA' ? 404 : 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    } finally {
      inflight.delete(key);
    }
  } catch (err: any) {
    log('Exception:', err?.message || err);
    const out: FailPayload = { ok: false, code: 'SERVER_ERROR' };
    return NextResponse.json(out, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
