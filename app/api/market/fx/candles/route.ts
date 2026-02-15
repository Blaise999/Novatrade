// app/api/market/fx/candles/route.ts
/**
 * FX CANDLES API - TWELVE DATA OHLC (RATE-LIMITED + CACHED)
 * =========================================================
 *
 * Goals:
 * - Stop blowing TwelveData credits on client polling
 * - Cache per symbol+tf+limit
 * - Deduplicate concurrent requests (1 upstream call per key)
 * - Enforce a global upstream budget (credits/min)
 * - Serve stale cache when rate-limited / upstream fails
 *
 * Env knobs (optional):
 * - FX_TWELVEDATA_CREDITS_PER_MIN      (default 7)
 * - FX_TWELVEDATA_MIN_INTERVAL_MS     (default 9000)
 * - FX_CANDLES_CACHE_TTL_MS           (default 10000)
 * - FX_CANDLES_CACHE_STALE_MS         (default 60000)
 * - FX_CANDLES_MAX_CACHE_ITEMS        (default 500)
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TWELVE_BASE = 'https://api.twelvedata.com';
const DEBUG = process.env.DEBUG_MARKET === '1';

const UPSTREAM_CREDITS_PER_MIN = Math.max(
  1,
  Number.parseInt(process.env.FX_TWELVEDATA_CREDITS_PER_MIN || '7', 10) || 7
);

// Minimum time between upstream fetches for the same key (pair+tf+limit)
const MIN_UPSTREAM_INTERVAL_MS = Math.max(
  1000,
  Number.parseInt(process.env.FX_TWELVEDATA_MIN_INTERVAL_MS || '9000', 10) || 9000
);

// If cache is newer than this, always return it (no upstream call)
const CACHE_TTL_MS = Math.max(
  500,
  Number.parseInt(process.env.FX_CANDLES_CACHE_TTL_MS || '10000', 10) || 10000
);

// If cache is older than TTL but within this stale window, we may still serve it
const CACHE_STALE_MS = Math.max(
  CACHE_TTL_MS,
  Number.parseInt(process.env.FX_CANDLES_CACHE_STALE_MS || '60000', 10) || 60000
);

const MAX_CACHE_ITEMS = Math.max(
  50,
  Number.parseInt(process.env.FX_CANDLES_MAX_CACHE_ITEMS || '500', 10) || 500
);

function log(...args: any[]) {
  if (DEBUG) console.log('[FX/candles]', ...args);
}

function safeSnippet(v: string, max = 240) {
  const t = String(v || '');
  return t.length > max ? t.slice(0, max) + '…' : t;
}

// ============================================
// TIMEFRAME UTILITIES
// ============================================

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

// ============================================
// SYMBOL CONVERSION
// ============================================

function toTwelveDisplay(symbolParam: string, displayParam: string): string {
  const symbol = (symbolParam || '').trim();
  const display = (displayParam || '').trim();

  // Prefer display if provided: EUR/USD
  if (display) return display.toUpperCase();

  // OANDA:EUR_USD -> EUR/USD
  if (symbol && symbol.includes(':')) {
    const stripped = symbol.split(':').slice(1).join(':');
    return stripped.toUpperCase().split('_').join('/');
  }

  // EUR_USD -> EUR/USD
  if (symbol && symbol.includes('_')) return symbol.toUpperCase().split('_').join('/');

  // EURUSD -> EUR/USD
  if (symbol && symbol.length === 6) {
    return `${symbol.slice(0, 3).toUpperCase()}/${symbol.slice(3).toUpperCase()}`;
  }

  // Already EUR/USD
  return symbol.toUpperCase();
}

function toFinnhubStyleSymbolFromDisplay(display: string): string {
  const clean = display.toUpperCase().split('/').join('_');
  return `OANDA:${clean}`;
}

// ============================================
// CANDLE TYPE
// ============================================

type RawCandle = {
  timestamp: string; // ISO
  time: number;      // epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// TwelveData returns "YYYY-MM-DD HH:mm:ss" (not strict ISO).
function parseTwelveDatetimeToEpochSec(dt: string): number {
  const s = String(dt || '').trim();
  if (!s) return 0;

  // Convert "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ssZ"
  const iso = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);

  if (!Number.isFinite(ms)) return 0;
  return Math.floor(ms / 1000);
}

function epochToIso(sec: number): string {
  return new Date(sec * 1000).toISOString();
}

// ============================================
// IN-MEMORY CACHE + RATE LIMIT (per instance)
// ============================================

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
};

type CacheEntry = {
  fetchedAt: number;
  payload: CachedPayload;
};

type InflightValue = {
  fetchedAt: number;
  entry: CacheEntry;
};

type Budget = {
  tokens: number;
  refillAt: number; // epoch ms
};

type FxState = {
  cache: Map<string, CacheEntry>;
  inflight: Map<string, Promise<InflightValue>>;
  lastUpstreamByKey: Map<string, number>;
  budget: Budget;
};

function getState(): FxState {
  const g = globalThis as any;
  if (!g.__fxCandlesState) {
    g.__fxCandlesState = {
      cache: new Map<string, CacheEntry>(),
      inflight: new Map<string, Promise<InflightValue>>(),
      lastUpstreamByKey: new Map<string, number>(),
      budget: {
        tokens: UPSTREAM_CREDITS_PER_MIN,
        refillAt: Date.now() + 60_000,
      },
    } satisfies FxState;
  }
  return g.__fxCandlesState as FxState;
}

function refillBudget(budget: Budget, now: number) {
  if (now >= budget.refillAt) {
    budget.tokens = UPSTREAM_CREDITS_PER_MIN;
    budget.refillAt = now + 60_000;
  }
}

function pruneCache(state: FxState) {
  if (state.cache.size <= MAX_CACHE_ITEMS) return;

  // Remove oldest entries first
  const items = Array.from(state.cache.entries())
    .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);

  const removeCount = state.cache.size - MAX_CACHE_ITEMS;
  for (let i = 0; i < removeCount; i++) {
    state.cache.delete(items[i]![0]);
  }
}

function makeKey(display: string, interval: string, limit: number) {
  return `${display}|${interval}|${limit}`;
}

function retryAfterSeconds(now: number, a?: number, b?: number) {
  const candidates = [a, b].filter((x): x is number => typeof x === 'number' && x > now);
  if (!candidates.length) return 5;
  return Math.max(1, Math.ceil((Math.max(...candidates) - now) / 1000));
}

// ============================================
// TWELVE DATA FETCHER
// ============================================

async function fetchTwelveCandles(params: {
  display: string;   // EUR/USD
  interval: string;  // 5min etc
  limit: number;     // outputsize
  apiKey: string;
}): Promise<{ candles: RawCandle[] | null; error: string | null; status: number }> {
  const url = new URL(`${TWELVE_BASE}/time_series`);
  url.searchParams.set('symbol', params.display);
  url.searchParams.set('interval', params.interval);
  url.searchParams.set('outputsize', String(params.limit));
  url.searchParams.set('apikey', params.apiKey);

  log('Upstream fetch:', { symbol: params.display, interval: params.interval, limit: params.limit });

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!res.ok || json?.status === 'error') {
      const msg =
        json?.message ||
        json?.error ||
        (res.status === 429 ? 'Rate limited by data provider (try again shortly).' : `Upstream error (${res.status})`);

      log('Upstream error:', { status: res.status, body: safeSnippet(text) });

      // If TwelveData returns 200 but status:"error", treat as 502
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

// ============================================
// MAIN HANDLER
// ============================================

export async function GET(req: NextRequest) {
  const started = Date.now();
  const state = getState();
  const now = Date.now();
  refillBudget(state.budget, now);

  try {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (!apiKey) {
      log('Missing TWELVEDATA_API_KEY');
      return NextResponse.json({ ok: false, error: 'Missing TWELVEDATA_API_KEY' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);

    const symbolParam = (searchParams.get('symbol') || '').trim();
    const displayParam = (searchParams.get('display') || '').trim();

    const tfParam = searchParams.get('tf') || '15m';
    const tf = tfNorm(tfParam);

    const rawLimit = Number(searchParams.get('limit') || 120);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 120, 10), 500);

    const display = toTwelveDisplay(symbolParam, displayParam);
    if (!display) {
      return NextResponse.json(
        { ok: false, error: 'Missing symbol=OANDA:EUR_USD or display=EUR/USD' },
        { status: 400 }
      );
    }

    const symbol = toFinnhubStyleSymbolFromDisplay(display);
    const resolution = tfToResolution(tf);
    const interval = tfToTwelveInterval(tf);

    const key = makeKey(display, interval, limit);
    const cached = state.cache.get(key);

    // 1) HARD CACHE HIT (fresh)
    if (cached && now - cached.fetchedAt <= CACHE_TTL_MS) {
      log('Cache HIT:', { key, ageMs: now - cached.fetchedAt });
      return NextResponse.json(cached.payload, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Cache': 'HIT',
        },
      });
    }

    // 2) IN-FLIGHT DEDUPE
    const inflight = state.inflight.get(key);
    if (inflight) {
      log('Inflight WAIT:', { key });
      const done = await inflight;
      return NextResponse.json(done.entry.payload, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Cache': 'DEDUPED',
        },
      });
    }

    // 3) PER-KEY MIN INTERVAL (avoid hammering same pair)
    const lastUp = state.lastUpstreamByKey.get(key) || 0;
    const nextAllowedByKey = lastUp ? lastUp + MIN_UPSTREAM_INTERVAL_MS : 0;

    // 4) GLOBAL UPSTREAM BUDGET
    const canSpend = state.budget.tokens > 0;
    const nextBudgetRefill = state.budget.refillAt;

    const blockedByKey = nextAllowedByKey && now < nextAllowedByKey;
    const blockedByBudget = !canSpend;

    if (blockedByKey || blockedByBudget) {
      // If we have cache that is not *too* old, serve it instead of error
      if (cached && now - cached.fetchedAt <= CACHE_STALE_MS) {
        log('Serve STALE (blocked):', {
          key,
          blockedByKey,
          blockedByBudget,
          ageMs: now - cached.fetchedAt,
        });

        const payload: CachedPayload = {
          ...cached.payload,
          stale: true,
          warning: blockedByBudget
            ? 'Upstream budget exhausted; served cached candles.'
            : 'Requests too frequent; served cached candles.',
          source: `${cached.payload.source}+cache`,
        };

        return NextResponse.json(payload, {
          status: 200,
          headers: {
            'Cache-Control': 'no-store',
            'X-Cache': 'STALE',
          },
        });
      }

      // No acceptable cache -> 429 with Retry-After
      const retrySec = retryAfterSeconds(
        now,
        blockedByKey ? nextAllowedByKey : undefined,
        blockedByBudget ? nextBudgetRefill : undefined
      );

      log('429 (no cache):', { key, blockedByKey, blockedByBudget, retrySec });

      return NextResponse.json(
        {
          ok: false,
          error: 'Rate limited (server) to protect data provider credits. Try again shortly.',
          symbol,
          display,
          tf,
          retryAfterSec: retrySec,
        },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(retrySec),
            'X-RateLimit-Reason': blockedByBudget ? 'budget' : 'per-key',
          },
        }
      );
    }

    // 5) Spend 1 upstream token and fetch (deduped)
    state.budget.tokens -= 1;
    state.lastUpstreamByKey.set(key, now);

    const p = (async (): Promise<InflightValue> => {
      const { candles, error } = await fetchTwelveCandles({
        display,
        interval,
        limit,
        apiKey,
      });

      if (error || !candles) {
        // Upstream failed: fallback to cache if available
        const fallback = state.cache.get(key);
        if (fallback && Date.now() - fallback.fetchedAt <= CACHE_STALE_MS) {
          const payload: CachedPayload = {
            ...fallback.payload,
            stale: true,
            warning: error || 'Upstream error; served cached candles.',
            source: `${fallback.payload.source}+cache`,
          };
          const entry: CacheEntry = { fetchedAt: fallback.fetchedAt, payload };
          return { fetchedAt: entry.fetchedAt, entry };
        }

        // No cache to fallback -> throw so handler returns error
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

      const entry: CacheEntry = { fetchedAt: Date.now(), payload };
      state.cache.set(key, entry);
      pruneCache(state);

      return { fetchedAt: entry.fetchedAt, entry };
    })();

    state.inflight.set(key, p);

    try {
      const done = await p;
      log('200:', {
        key,
        count: done.entry.payload.count,
        tookMs: Date.now() - started,
        budgetLeft: state.budget.tokens,
      });

      return NextResponse.json(done.entry.payload, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Cache': 'MISS',
        },
      });
    } finally {
      state.inflight.delete(key);
    }
  } catch (err: any) {
    log('Exception:', err?.message);
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
