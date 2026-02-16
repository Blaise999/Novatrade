// app/api/market/stocks/history/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CacheEntry = { ts: number; data: any };
const g = globalThis as any;
g.__ALPACA_STOCK_HISTORY_CACHE ||= new Map<string, CacheEntry>();
const CACHE: Map<string, CacheEntry> = g.__ALPACA_STOCK_HISTORY_CACHE;

const TTL_MS = 12_000;

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function alpacaHeaders() {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) throw new Error('Missing Alpaca env keys');
  return {
    accept: 'application/json',
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
  } as Record<string, string>;
}

async function fetchJson(url: string, timeoutMs = 12_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: alpacaHeaders(), signal: ac.signal, cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) {
      const err: any = new Error(text || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(t);
  }
}

function toTf(interval: string) {
  const tf = (interval || '').toLowerCase();

  if (tf === '1m' || tf === '1min' || tf === '1minute') return '1Min';
  if (tf === '5m' || tf === '5min' || tf === '5minute') return '5Min';
  if (tf === '15m' || tf === '15min' || tf === '15minute') return '15Min';
  if (tf === '1h' || tf === '1hour') return '1Hour';
  if (tf === '4h' || tf === '4hour') return '4Hour';
  if (tf === '1d' || tf === '1day' || tf === 'day' || tf === '1D') return '1Day';

  // also accept Alpaca already-formatted values
  if (['1Min', '5Min', '15Min', '1Hour', '4Hour', '1Day'].includes(interval)) return interval;

  return '15Min';
}

function tfSeconds(tf: string) {
  switch (tf) {
    case '1Min':
      return 60;
    case '5Min':
      return 300;
    case '15Min':
      return 900;
    case '1Hour':
      return 3600;
    case '4Hour':
      return 14400;
    case '1Day':
      return 86400;
    default:
      return 900;
  }
}

function normalizeUnixSec(x: number) {
  // if user accidentally sends ms, convert -> sec
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (x > 1_000_000_000_000) return Math.floor(x / 1000);
  return Math.floor(x);
}

function defaultRange(tf: string, limit: number) {
  const nowSec = Math.floor(Date.now() / 1000);
  const sec = tfSeconds(tf);

  // buffer 2x so we still get enough bars even if market closed for some of the period
  const span = sec * limit * 2;

  // cap to ~2 years just to avoid insane ranges
  const maxSpan = 86400 * 730;
  const fromSec = Math.max(nowSec - Math.min(span, maxSpan), 1);

  return { fromSec, toSec: nowSec };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const symbol = String(url.searchParams.get('symbol') || '').trim().toUpperCase();
  if (!symbol) return NextResponse.json({ candles: [] }, { status: 200 });

  const tfParam = String(url.searchParams.get('tf') || url.searchParams.get('resolution') || '15m');
  const tf = toTf(tfParam);

  const limitRaw = Number(url.searchParams.get('limit') || 300);
  const limit = Number.isFinite(limitRaw) ? Math.max(10, Math.min(500, Math.floor(limitRaw))) : 300;

  const fromQ = normalizeUnixSec(Number(url.searchParams.get('from')));
  const toQ = normalizeUnixSec(Number(url.searchParams.get('to')));

  const { fromSec, toSec } =
    fromQ > 0 && toQ > fromQ ? { fromSec: fromQ, toSec: toQ } : defaultRange(tf, limit);

  // ✅ default feed to iex so it works on free plans
  const feed = String(url.searchParams.get('feed') || process.env.ALPACA_DATA_FEED || 'iex').trim();

  const qs = new URLSearchParams({
    symbols: symbol,
    timeframe: tf,
    limit: String(limit),
    feed,
    start: new Date(fromSec * 1000).toISOString(),
    end: new Date(toSec * 1000).toISOString(),
  });

  const upstream = `https://data.alpaca.markets/v2/stocks/bars?${qs.toString()}`;
  const cacheKey = `history:${qs.toString()}`;

  const cached = CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data, { status: 200 });
  }

  try {
    const json = await fetchJson(upstream);

    // Alpaca bars: { bars: { AAPL: [ {t,o,h,l,c,v}, ... ] } }
    const arr: any[] =
      (json?.bars && json?.bars?.[symbol] && Array.isArray(json.bars[symbol]) && json.bars[symbol]) || [];

    const candles = arr
      .map((b: any) => ({
        time: String(b?.t || b?.time || ''),
        open: n(b?.o ?? b?.open, 0),
        high: n(b?.h ?? b?.high, 0),
        low: n(b?.l ?? b?.low, 0),
        close: n(b?.c ?? b?.close, 0),
        volume: b?.v ?? b?.volume,
      }))
      .filter((c: any) => c.time && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0);

    const payload = { candles };
    CACHE.set(cacheKey, { ts: now, data: payload });
    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    // serve stale cache if we have it
    if (cached?.data) {
      return NextResponse.json(cached.data, { status: 200, headers: { 'x-stale': '1' } });
    }
    const status = Number(e?.status) || 500;
    return NextResponse.json({ error: String(e?.message || 'Market data error'), candles: [] }, { status });
  }
}
