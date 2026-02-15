// app/api/market/fx/candles/route.ts
/**
 * FX CANDLES API - TWELVE DATA OHLC
 * =======================================
 *
 * Fetches forex candle data from Twelve Data (OHLC out of the box).
 *
 * Query params:
 * - symbol: OANDA:EUR_USD format (we convert to EUR/USD)
 * - display: EUR/USD format (preferred)
 * - tf: timeframe (1m, 5m, 15m, 1h, 4h, 1D)
 * - limit: number of candles (default 120, max 500)
 *
 * Notes:
 * - This endpoint is meant to be polled by the client for “live-ish” updates.
 * - Supports multiple API keys with daily (790 credits/day) and per-minute (8 credits/min) limiting per key.
 * - Randomizes selection among eligible keys (under limits) for even distribution.
 * - Uses file-based storage for usage counts (api_usage.json). Note: In production, use a database or Redis for persistence and concurrency.
 * - Assumes 1 call = 1 credit for time_series endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TWELVE_BASE = 'https://api.twelvedata.com';
const DEBUG = process.env.DEBUG_MARKET === '1';
const USAGE_FILE = path.join(process.cwd(), 'api_usage.json');
const DAILY_LIMIT = 790;
const MINUTE_LIMIT = 8;
const MINUTE_MS = 60000;

function log(...args: any[]) {
  if (DEBUG) console.log('[FX/candles]', ...args);
}

function safeSnippet(v: string, max = 240) {
  const t = String(v || '');
  return t.length > max ? t.slice(0, max) + '…' : t;
}

// ============================================
// USAGE TRACKING
// ============================================

interface UsageData {
  [key: string]: { date: string; count: number; last_requests: number[] };
}

async function getUsage(): Promise<UsageData> {
  try {
    const data = await fs.readFile(USAGE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

async function saveUsage(usage: UsageData) {
  await fs.writeFile(USAGE_FILE, JSON.stringify(usage, null, 2));
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getMinuteCount(usage: UsageData, apiKey: string): number {
  const now = Date.now();
  const requests = usage[apiKey]?.last_requests || [];
  return requests.filter(ts => now - ts < MINUTE_MS).length;
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
  // Keep compatibility with your frontend shape (symbol like OANDA:EUR_USD)
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
// TWELVE DATA FETCHER
// ============================================

async function fetchTwelveCandles(params: {
  display: string;   // EUR/USD
  interval: string;  // 5min etc
  limit: number;     // outputsize
  apiKeys: string[]; // Array of keys
}): Promise<{ candles: RawCandle[] | null; error: string | null; status: number }> {
  const today = getTodayDate();
  const now = Date.now();
  let usage = await getUsage();

  // Filter eligible keys: under daily and minute limits
  const eligibleKeys = params.apiKeys.filter(apiKey => {
    if (!usage[apiKey]) {
      usage[apiKey] = { date: today, count: 0, last_requests: [] };
    }
    if (usage[apiKey].date !== today) {
      usage[apiKey] = { date: today, count: 0, last_requests: [] };
    }
    const minuteCount = getMinuteCount(usage, apiKey);
    return usage[apiKey].count < DAILY_LIMIT && minuteCount < MINUTE_LIMIT;
  });

  if (eligibleKeys.length === 0) {
    return { candles: null, error: 'All API keys exceeded limits.', status: 429 };
  }

  // Shuffle eligible keys for randomization
  const shuffledEligible = eligibleKeys.sort(() => 0.5 - Math.random());

  for (const apiKey of shuffledEligible) {
    const keyHash = apiKey.slice(0, 4) + '...'; // For logging

    // Double-check limits (in case concurrent updates)
    const minuteCount = getMinuteCount(usage, apiKey);
    if (usage[apiKey].count >= DAILY_LIMIT || minuteCount >= MINUTE_LIMIT) {
      continue;
    }

    const url = new URL(`${TWELVE_BASE}/time_series`);
    url.searchParams.set('symbol', params.display);
    url.searchParams.set('interval', params.interval);
    url.searchParams.set('outputsize', String(params.limit));
    url.searchParams.set('apikey', apiKey);

    log('Fetching candles with key:', keyHash, { symbol: params.display, interval: params.interval, limit: params.limit, dailyCount: usage[apiKey].count, minuteCount });

    try {
      const res = await fetch(url.toString(), {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });

      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { json = null; }

      // TwelveData uses { status: "error", message: "..." }
      if (!res.ok || json?.status === 'error') {
        const msg =
          json?.message ||
          json?.error ||
          (res.status === 429 ? 'Rate limited by data provider.' : `Upstream error (${res.status})`);

        log('Upstream error with key', keyHash, { status: res.status, body: safeSnippet(text) });
        continue;
      }

      const values = Array.isArray(json?.values) ? json.values : [];

      // values are usually newest-first; convert to ascending
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

      // Increment counts on success
      usage[apiKey].count += 1;
      usage[apiKey].last_requests.push(now);
      // Prune old requests
      usage[apiKey].last_requests = usage[apiKey].last_requests.filter(ts => now - ts < MINUTE_MS);
      await saveUsage(usage);

      log('Success with key:', keyHash, 'New daily count:', usage[apiKey].count, 'New minute count:', getMinuteCount(usage, apiKey));
      return { candles, error: null, status: 200 };
    } catch (err: any) {
      log('Network error with key', keyHash, err?.message);
      continue; // Try next key on network errors
    }
  }

  return { candles: null, error: 'All eligible API keys failed.', status: 429 };
}

// ============================================
// MAIN HANDLER
// ============================================

export async function GET(req: NextRequest) {
  const started = Date.now();

  try {
    const apiKeysRaw = process.env.TWELVEDATA_API_KEYS;
    if (!apiKeysRaw) {
      log('Missing TWELVEDATA_API_KEYS (comma-separated)');
      return NextResponse.json({ ok: false, error: 'Missing TWELVEDATA_API_KEYS' }, { status: 500 });
    }

    const apiKeys = apiKeysRaw.split(',').map(k => k.trim()).filter(Boolean);
    if (apiKeys.length < 1) {
      log('No valid API keys provided');
      return NextResponse.json({ ok: false, error: 'No valid TWELVEDATA_API_KEYS' }, { status: 500 });
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

    log('Request params:', { symbol, display, tf, interval, limit, keyCount: apiKeys.length });

    const { candles, error, status } = await fetchTwelveCandles({
      display,
      interval,
      limit,
      apiKeys,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error, symbol, display, tf },
        { status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const validated = (candles || []).map((c) => ({
      time: c.time,
      timestamp: c.timestamp,
      open: c.open,
      high: Math.max(c.open, c.high, c.low, c.close),
      low: Math.min(c.open, c.high, c.low, c.close),
      close: c.close,
      volume: c.volume || 0,
    }));

    log('Response:', { count: validated.length, tookMs: Date.now() - started });

    return NextResponse.json(
      {
        ok: true,
        symbol,
        display,
        tf,
        resolution,
        count: validated.length,
        candles: validated,
        source: 'twelvedata',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    log('Exception:', err?.message);
    return NextResponse.json({ ok: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}